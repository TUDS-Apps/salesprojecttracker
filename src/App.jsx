import React, { useState, useEffect, createContext, useContext } from 'react';
import { db } from './firebase'; // Make sure firebase.js is in the src folder
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, deleteDoc, doc, getDoc, getDocs, writeBatch, setDoc, updateDoc } from "firebase/firestore"; // Added updateDoc

// Tailwind CSS is assumed to be available globally.

// --- Configuration ---
const SALESPERSONS = [
    { id: 'dale', name: 'Dale', initials: 'DA' },
    { id: 'justin', name: 'Justin', initials: 'JU' },
    { id: 'karen', name: 'Karen', initials: 'KA' },
    { id: 'meghan', name: 'Meghan', initials: 'ME' },
    { id: 'pat', name: 'Pat', initials: 'PA' },
    { id: 'rickielee', name: 'Rickie-Lee', initials: 'RL' },
    { id: 'roberta', name: 'Roberta', initials: 'RO' },
    { id: 'shane', name: 'Shane', initials: 'SH' },
    { id: 'steve', name: 'Steve', initials: 'ST' },
    { id: 'wade', name: 'Wade', initials: 'WA' },
    { id: 'sam', name: 'Sam', initials: 'SA' }, 
].sort((a, b) => a.name.localeCompare(b.name));

const PROJECT_TYPES = [
    { id: 'railing', name: 'Railing', icon: 'railing.png' },
    { id: 'deck', name: 'Deck', icon: 'deck.png' },
    { id: 'hardscapes', name: 'Hardscapes', icon: 'hardscapes.png' },
    { id: 'fence', name: 'Fence', icon: 'fence.png' },
    { id: 'pergola', name: 'Pergola', icon: 'pergola.png' },
    { id: 'turf', name: 'Turf', icon: 'turf.png' },
];

const DEFAULT_WEEKLY_GOAL = 60; 

const PROJECTS_COLLECTION = 'projects';
const WEEKLY_RECORDS_COLLECTION = 'weeklyRecords'; 
const APP_SETTINGS_COLLECTION = 'appSettings'; 
const GOALS_DOCUMENT_ID = 'goals'; 

const LOCATIONS = { 
    REGINA: { id: 'regina', name: 'Regina', abbreviation: 'RGNA', tileColor: 'bg-blue-100/80 border-blue-400', bucketColor: 'border-blue-400 bg-blue-50 hover:bg-blue-100', textColor: 'text-blue-700', bucketOverColor: 'border-blue-600 bg-blue-100 scale-105' },
    SASKATOON: { id: 'saskatoon', name: 'Saskatoon', abbreviation: 'SKTN', tileColor: 'bg-green-100/80 border-green-400', bucketColor: 'border-green-400 bg-green-50 hover:bg-green-100', textColor: 'text-green-700', bucketOverColor: 'border-green-600 bg-green-100 scale-105' }
};

const isIconUrl = (iconString) => typeof iconString === 'string' && (iconString.startsWith('http') || iconString.startsWith('/') || iconString.includes('.'));

const formatDate = (date, options = { month: 'short', day: 'numeric' }) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString(undefined, options);
};

const getWeekEndDate = (dateForWeek) => {
    const date = new Date(dateForWeek);
    const day = date.getDay(); 
    const diff = date.getDate() - day + (day === 0 ? 0 : 7); 
    return new Date(date.setDate(diff));
};

const getWeekStartDate = (sundayEndDate) => {
    const startDate = new Date(sundayEndDate);
    startDate.setDate(sundayEndDate.getDate() - 6);
    return startDate;
};

const AppContext = createContext();

const AppProvider = ({ children }) => {
    const [loggedProjects, setLoggedProjects] = useState([]);
    const [weeklyRecords, setWeeklyRecords] = useState([]); 
    const [currentWeeklyGoal, setCurrentWeeklyGoal] = useState(DEFAULT_WEEKLY_GOAL); 
    const [currentPage, setCurrentPage] = useState('input');
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessingWeek, setIsProcessingWeek] = useState(false); 
    const [isUpdatingTarget, setIsUpdatingTarget] = useState(false);
    const [isUpdatingRecord, setIsUpdatingRecord] = useState(false); // For loading state of record update

    useEffect(() => {
        const getInitialPage = () => {
            const hash = window.location.hash;
            if (hash === '#/display') return 'display';
            if (hash === '#/input') return 'input';
            const storedPage = localStorage.getItem('salesTrackerCurrentPage');
            return storedPage === 'display' ? 'display' : 'input';
        };
        setCurrentPage(getInitialPage());
    }, []);

    useEffect(() => {
        const goalDocRef = doc(db, APP_SETTINGS_COLLECTION, GOALS_DOCUMENT_ID);
        const unsubscribeGoal = onSnapshot(goalDocRef, async (docSnap) => {
            if (docSnap.exists()) {
                setCurrentWeeklyGoal(docSnap.data().currentWeeklyTarget || DEFAULT_WEEKLY_GOAL);
            } else {
                try {
                    await setDoc(goalDocRef, { currentWeeklyTarget: DEFAULT_WEEKLY_GOAL });
                    setCurrentWeeklyGoal(DEFAULT_WEEKLY_GOAL);
                    console.log("Goals document created with default target.");
                } catch (error) {
                    console.error("Error creating goals document: ", error);
                }
            }
        }, (error) => {
            console.error("Error fetching weekly goal: ", error);
            setCurrentWeeklyGoal(DEFAULT_WEEKLY_GOAL);
        });
        return () => unsubscribeGoal();
    }, []);

    useEffect(() => {
        setIsLoading(true); 
        const projectsQuery = query(collection(db, PROJECTS_COLLECTION), orderBy('timestamp', 'desc'));
        const recordsQuery = query(collection(db, WEEKLY_RECORDS_COLLECTION), orderBy('weekEndDate', 'desc'));
        let projectsLoaded = false;
        let recordsLoaded = false;
        const checkAllLoaded = () => { if (projectsLoaded && recordsLoaded) setIsLoading(false); };

        const unsubscribeProjects = onSnapshot(projectsQuery, (querySnapshot) => {
            const projectsData = querySnapshot.docs.map(pDoc => ({ ...pDoc.data(), id: pDoc.id }));
            setLoggedProjects(projectsData);
            handleAutoSundayReset(projectsData); 
            projectsLoaded = true; checkAllLoaded();
        }, (error) => { console.error("Error fetching projects: ", error); alert("Could not fetch project data."); projectsLoaded = true; checkAllLoaded(); });

        const unsubscribeRecords = onSnapshot(recordsQuery, (querySnapshot) => {
            const recordsData = querySnapshot.docs.map(rDoc => ({ ...rDoc.data(), id: rDoc.id }));
            setWeeklyRecords(recordsData);
            recordsLoaded = true; checkAllLoaded();
        }, (error) => { console.error("Error fetching weekly records: ", error); alert("Could not fetch weekly records."); recordsLoaded = true; checkAllLoaded(); });
        
        Promise.all([getDocs(projectsQuery), getDocs(recordsQuery)])
            .then(() => { projectsLoaded = true; recordsLoaded = true; checkAllLoaded(); })
            .catch(() => { projectsLoaded = true; recordsLoaded = true; checkAllLoaded(); });

        return () => { unsubscribeProjects(); unsubscribeRecords(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); 

    const handleSetCurrentPage = (page) => { /* ... same ... */ 
        setCurrentPage(page);
        localStorage.setItem('salesTrackerCurrentPage', page);
        window.location.hash = page === 'display' ? '#/display' : '#/input';
    };
    const addProjectToFirebase = async (salespersonId, projectTypeId, locationId) => { /* ... same ... */ 
        const salesperson = SALESPERSONS.find(s => s.id === salespersonId);
        const projectType = PROJECT_TYPES.find(p => p.id === projectTypeId);
        const locationDetails = LOCATIONS[locationId.toUpperCase()]; 

        if (!salesperson || !projectType || !locationDetails) {
            alert("Error: Invalid salesperson, project type, or location selected.");
            return false;
        }
        try {
            await addDoc(collection(db, PROJECTS_COLLECTION), {
                salespersonId,
                salespersonInitials: salesperson.initials,
                salespersonName: salesperson.name,
                projectTypeId,
                projectIcon: projectType.icon,
                projectName: projectType.name,
                location: locationDetails.id, 
                timestamp: serverTimestamp(),
            });
            return true;
        } catch (error) {
            console.error("Error adding project: ", error);
            alert("Error logging project. Please check console for details.");
            return false;
        }
    };
    const updateWeeklyTargetInDB = async (newTarget) => { /* ... same ... */ 
        if (isNaN(newTarget) || newTarget <= 0) {
            alert("Please enter a valid positive number for the target.");
            return false;
        }
        setIsUpdatingTarget(true);
        const goalDocRef = doc(db, APP_SETTINGS_COLLECTION, GOALS_DOCUMENT_ID);
        try {
            await setDoc(goalDocRef, { currentWeeklyTarget: Number(newTarget) }, { merge: true });
            alert("Weekly target updated successfully!");
            return true;
        } catch (error) {
            console.error("Error updating weekly target: ", error);
            alert("Failed to update weekly target.");
            return false;
        } finally {
            setIsUpdatingTarget(false);
        }
    };
    const deleteAllProjectsFromBoard = async () => { /* ... same ... */ 
        const projectsQuerySnapshot = await getDocs(collection(db, PROJECTS_COLLECTION));
        if (projectsQuerySnapshot.empty) return;
        const batch = writeBatch(db);
        projectsQuerySnapshot.docs.forEach(pDoc => {
            batch.delete(doc(db, PROJECTS_COLLECTION, pDoc.id));
        });
        await batch.commit();
    };
    
    const logWeekAndResetBoard = async (isAuto = false, projectsForLog = loggedProjects) => { /* ... same ... */ 
        if (!isAuto && !window.confirm("This will log the current week's project count, save it, and then clear the display board. Are you sure?")) {
            return;
        }
        setIsProcessingWeek(true);
        try {
            const today = new Date();
            const weekEnd = getWeekEndDate(today); 
            const weekStart = getWeekStartDate(weekEnd);
            const weekDisplay = `${formatDate(weekStart)} - ${formatDate(weekEnd)}`;
            const completed = projectsForLog.length; 

            let topSalespersonName = "N/A";
            let topSalespersonProjects = 0;

            if (projectsForLog.length > 0) {
                const salesCounts = projectsForLog.reduce((acc, project) => {
                    acc[project.salespersonId] = (acc[project.salespersonId] || 0) + 1;
                    return acc;
                }, {});
                let maxProjects = 0;
                let topSpId = null;
                for (const spId in salesCounts) {
                    if (salesCounts[spId] > maxProjects) {
                        maxProjects = salesCounts[spId];
                        topSpId = spId;
                    }
                }
                if (topSpId) {
                    const topSp = SALESPERSONS.find(s => s.id === topSpId);
                    if (topSp) {
                        topSalespersonName = topSp.name;
                        topSalespersonProjects = maxProjects;
                    }
                }
            }

            const newRecord = {
                weekDisplay,
                completed,
                target: currentWeeklyGoal, 
                weekEndDate: weekEnd.toISOString(), 
                topSalespersonName, 
                topSalespersonProjects, 
                loggedAt: serverTimestamp()
            };

            await addDoc(collection(db, WEEKLY_RECORDS_COLLECTION), newRecord);
            await deleteAllProjectsFromBoard();

            if (!isAuto) alert("Current projects logged for the week and display board has been reset.");
            else console.log("Weekly projects automatically logged and board reset.");

        } catch (error) {
            console.error("Error logging week and resetting board: ", error);
            alert("An error occurred while logging the week and resetting the board.");
        } finally {
            setIsProcessingWeek(false);
        }
    };

    const updateWeeklyRecordInDB = async (recordId, updatedData) => {
        if (!recordId || !updatedData) {
            alert("Missing data for update.");
            return false;
        }
        setIsUpdatingRecord(true);
        const recordDocRef = doc(db, WEEKLY_RECORDS_COLLECTION, recordId);
        try {
            await updateDoc(recordDocRef, updatedData);
            alert("Weekly record updated successfully!");
            return true;
        } catch (error) {
            console.error("Error updating weekly record: ", error);
            alert("Failed to update weekly record.");
            return false;
        } finally {
            setIsUpdatingRecord(false);
        }
    };

    const handleAutoSundayReset = async (currentProjects) => { /* ... same ... */ 
        const today = new Date();
        if (today.getDay() === 0) { 
            const todayISO = today.toISOString().split('T')[0]; 
            const lastAutoResetSunday = localStorage.getItem('lastAutoResetSunday');

            if (lastAutoResetSunday !== todayISO) {
                if (currentProjects && currentProjects.length > 0) { 
                    console.log("Attempting automatic Sunday log and reset...");
                    await logWeekAndResetBoard(true, currentProjects); 
                    localStorage.setItem('lastAutoResetSunday', todayISO);
                } else {
                    localStorage.setItem('lastAutoResetSunday', todayISO);
                    console.log("Automatic Sunday check: No projects to log, board is already clear or was cleared. Marked Sunday as processed.");
                }
            }
        }
    };

    return (
        <AppContext.Provider value={{ 
            loggedProjects, weeklyRecords, addProject: addProjectToFirebase, currentPage, 
            setCurrentPage: handleSetCurrentPage, weeklyGoal: currentWeeklyGoal, 
            updateWeeklyTarget: updateWeeklyTargetInDB, 
            salespersons: SALESPERSONS, projectTypes: PROJECT_TYPES, 
            logWeekAndResetBoard, updateWeeklyRecord: updateWeeklyRecordInDB, // Pass new update function
            isLoading, isProcessingWeek, isUpdatingTarget, isUpdatingRecord, // Pass new loading state
            locationsData: LOCATIONS 
        }}>
            {children}
        </AppContext.Provider>
    );
};

// --- UI Components ---
const Card = ({ children, className = '' }) => ( /* ... same ... */ 
    <div className={`bg-white shadow-xl rounded-lg p-6 md:p-8 ${className}`}>
        {children}
    </div>
);
const Button = ({ children, onClick, className = '', variant = 'primary', disabled = false }) => ( /* ... same ... */ 
    <button onClick={onClick} disabled={disabled}
        className={`px-6 py-3 rounded-lg font-semibold shadow-md focus:outline-none focus:ring-2 focus:ring-opacity-75 transition-all ${
            variant === 'primary' ? 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500' :
            variant === 'secondary' ? 'bg-gray-200 hover:bg-gray-300 text-gray-800 focus:ring-gray-400' :
            'bg-red-500 hover:bg-red-600 text-white focus:ring-red-400' // Default to danger or add more variants
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}>
        {children}
    </button>
);
const LoadingSpinner = ({ message = "Loading..."}) => ( /* ... same ... */ 
    <div className="flex flex-col items-center justify-center p-10 text-gray-700">
        <svg className="animate-spin h-10 w-10 text-blue-600 mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle>
          <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75"></path>
        </svg>
        <p className="text-lg">{message}</p>
    </div>
);
const createConfettiPiece = () => { /* ... same as before ... */ 
    const piece = document.createElement('div');
    piece.style.position = 'fixed';
    piece.style.left = `${Math.random() * 100}vw`;
    piece.style.top = `${Math.random() * -20 - 10}vh`;
    piece.style.width = `${Math.random() * 12 + 6}px`;
    piece.style.height = piece.style.width;
    piece.style.backgroundColor = `hsl(${Math.random() * 360}, 100%, 60%)`;
    piece.style.opacity = '0';
    piece.style.zIndex = '10001'; 
    piece.style.borderRadius = `${Math.random() > 0.5 ? '50%' : '0px'}`;
    piece.style.transform = `rotate(${Math.random() * 360}deg)`;
    document.body.appendChild(piece);
    return piece;
};
const animateConfettiPiece = (piece) => { /* ... same as before ... */
    const fallDuration = Math.random() * 3 + 2.5; 
    const swayAmount = Math.random() * 200 - 100; 
    const rotation = Math.random() * 720 + 360; 
    piece.animate([
        { transform: `translate3d(0, 0, 0) rotate(${piece.style.transform.match(/\d+/)[0]}deg)`, opacity: 1 },
        { transform: `translate3d(${swayAmount}px, 110vh, 0) rotate(${rotation}deg)`, opacity: 0 }
    ], {
        duration: fallDuration * 1000,
        easing: 'ease-out',
        iterations: 1
    });
    setTimeout(() => { if (piece.parentNode) piece.parentNode.removeChild(piece); }, fallDuration * 1000);
};
const triggerConfetti = (count = 150) => { /* ... same as before ... */
    for (let i = 0; i < count; i++) {
        setTimeout(() => { const piece = createConfettiPiece(); animateConfettiPiece(piece); }, i * 15);
    }
};
const ProjectIcon = ({ project, onDragStart }) => ( /* ... same as before ... */ 
    <div draggable onDragStart={(e) => onDragStart(e, project.id)}
        className="flex flex-col items-center justify-center p-1 sm:p-2 m-1 border-2 border-dashed border-gray-300 rounded-lg cursor-grab hover:bg-gray-100 transition-colors aspect-square"
        title={project.name}>
        {isIconUrl(project.icon) ? (
            <img 
                src={project.icon} 
                alt={project.name} 
                className="w-20 h-20 sm:w-24 sm:h-24 object-contain pointer-events-none"
                onError={(e) => { e.target.src='https://placehold.co/64x64/cccccc/969696?text=IMG'; e.target.alt = 'Image not found'; }}
            />
        ) : (
            <span className="text-5xl sm:text-6xl pointer-events-none">{project.icon}</span>
        )}
    </div>
);
const LocationBucket = ({ locationDetails, onDrop, onDragOver, onDragLeave, isOver, projectCount }) => ( /* ... same as before ... */ 
    <div onDrop={(e) => onDrop(e, locationDetails.id)} onDragOver={onDragOver} onDragLeave={onDragLeave}
        className={`mt-6 p-6 md:p-8 border-4 border-dashed rounded-xl text-center transition-all duration-200 ease-in-out min-h-[150px] flex flex-col justify-center items-center
                  ${isOver ? locationDetails.bucketOverColor : locationDetails.bucketColor}`}>
        <h3 className={`text-xl font-semibold mb-2 ${locationDetails.textColor}`}>{locationDetails.name} Projects</h3>
        <svg className={`w-12 h-12 mb-2 ${isOver ? locationDetails.textColor : locationDetails.textColor } opacity-70`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
        <p className={`text-md font-medium ${locationDetails.textColor}`}>
            {isOver ? "Release to log!" : "Drag Project Here"}
        </p>
        <p className={`text-sm ${locationDetails.textColor} opacity-80`}>{projectCount} logged</p>
    </div>
);

const WeeklyLogDisplay = () => {
    const { weeklyRecords, isLoading, logWeekAndResetBoard, isProcessingWeek, weeklyGoal, updateWeeklyTarget, isUpdatingTarget, updateWeeklyRecord, isUpdatingRecord } = useContext(AppContext); 
    const [newTargetInput, setNewTargetInput] = useState(weeklyGoal.toString());
    const [editingRecordId, setEditingRecordId] = useState(null);
    const [editFormData, setEditFormData] = useState({ completed: '', topSalespersonName: '', topSalespersonProjects: '' });

    useEffect(() => {
        setNewTargetInput(weeklyGoal.toString());
    }, [weeklyGoal]);

    const handleTargetSubmit = async (e) => {
        e.preventDefault();
        const targetValue = parseInt(newTargetInput, 10);
        if (!isNaN(targetValue) && targetValue > 0) {
            await updateWeeklyTarget(targetValue);
        } else {
            alert("Please enter a valid positive number for the target.");
        }
    };

    const handleEditClick = (record) => {
        setEditingRecordId(record.id);
        setEditFormData({
            completed: record.completed.toString(),
            topSalespersonName: record.topSalespersonName || '',
            topSalespersonProjects: record.topSalespersonProjects?.toString() || '0',
            target: record.target.toString() // Keep original target for display, not editable here
        });
    };

    const handleEditFormChange = (e) => {
        setEditFormData({ ...editFormData, [e.target.name]: e.target.value });
    };

    const handleSaveEdit = async (recordId) => {
        const completed = parseInt(editFormData.completed, 10);
        const topSalespersonProjects = parseInt(editFormData.topSalespersonProjects, 10);

        if (isNaN(completed) || completed < 0) {
            alert("Please enter a valid number for completed projects.");
            return;
        }
        if (isNaN(topSalespersonProjects) || topSalespersonProjects < 0) {
            alert("Please enter a valid number for top salesperson projects.");
            return;
        }
        
        const success = await updateWeeklyRecord(recordId, {
            completed,
            topSalespersonName: editFormData.topSalespersonName,
            topSalespersonProjects
        });
        if (success) {
            setEditingRecordId(null);
        }
    };

    if (isLoading && weeklyRecords.length === 0) { 
        return <LoadingSpinner message="Loading weekly records..." />;
    }

    return (
        <Card className="bg-gray-50 h-full flex flex-col">
            <h2 className="text-2xl font-semibold text-gray-700 mb-4 text-center">Weekly Performance</h2>
            {weeklyRecords.length > 0 ? (
                <ul className="space-y-2 max-h-64 overflow-y-auto pr-2 flex-grow mb-4"> 
                    {weeklyRecords.map(record => (
                        <li key={record.id} className={`p-3 rounded-lg shadow text-gray-700 ${record.completed >= record.target ? 'bg-green-100 border-green-400' : 'bg-red-100 border-red-400'}`}>
                            {editingRecordId === record.id ? (
                                <div className="space-y-2">
                                    <p className="font-medium text-md mb-1">{record.weekDisplay} (Target: {editFormData.target})</p>
                                    <div>
                                        <label htmlFor={`editCompleted-${record.id}`} className="text-xs font-medium text-gray-600">Completed:</label>
                                        <input type="number" name="completed" id={`editCompleted-${record.id}`} value={editFormData.completed} onChange={handleEditFormChange} className="w-full p-1 border border-gray-300 rounded text-sm"/>
                                    </div>
                                    <div>
                                        <label htmlFor={`editTopSalespersonName-${record.id}`} className="text-xs font-medium text-gray-600">Top Salesperson:</label>
                                        <input type="text" name="topSalespersonName" id={`editTopSalespersonName-${record.id}`} value={editFormData.topSalespersonName} onChange={handleEditFormChange} className="w-full p-1 border border-gray-300 rounded text-sm"/>
                                    </div>
                                    <div>
                                        <label htmlFor={`editTopSalespersonProjects-${record.id}`} className="text-xs font-medium text-gray-600">Their Projects:</label>
                                        <input type="number" name="topSalespersonProjects" id={`editTopSalespersonProjects-${record.id}`} value={editFormData.topSalespersonProjects} onChange={handleEditFormChange} className="w-full p-1 border border-gray-300 rounded text-sm"/>
                                    </div>
                                    <div className="flex gap-2 mt-2">
                                        <Button onClick={() => handleSaveEdit(record.id)} variant="primary" className="py-1 px-3 text-xs" disabled={isUpdatingRecord}>{isUpdatingRecord ? "Saving..." : "Save"}</Button>
                                        <Button onClick={() => setEditingRecordId(null)} variant="secondary" className="py-1 px-3 text-xs">Cancel</Button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="font-medium text-md">{record.weekDisplay}</span>
                                        <span className={`font-bold text-lg ${record.completed >= record.target ? 'text-green-600' : 'text-red-600'}`}>
                                            {record.completed}/{record.target}
                                        </span>
                                    </div>
                                    {record.topSalespersonName && record.topSalespersonName !== "N/A" && (
                                        <p className="text-xs text-gray-600">
                                            Top: {record.topSalespersonName} ({record.topSalespersonProjects})
                                        </p>
                                    )}
                                    <p className="text-xs text-gray-500 mt-0.5">
                                        {record.completed >= record.target ? `Goal Met! 🎉 (+${record.completed - record.target})` : `Short by ${record.target - record.completed}`}
                                    </p>
                                    <Button onClick={() => handleEditClick(record)} variant="secondary" className="py-1 px-2 text-xs mt-2 float-right" disabled={isUpdatingRecord || isProcessingWeek}>Edit</Button>
                                </>
                            )}
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-gray-600 text-center py-4 flex-grow flex items-center justify-center">No weekly records yet.</p>
            )}
            <form onSubmit={handleTargetSubmit} className="mt-auto pt-4 border-t border-gray-200">
                <label htmlFor="weeklyTargetInput" className="block text-sm font-medium text-gray-700 mb-1">Set Weekly Target:</label>
                <div className="flex items-center gap-2 mb-3">
                    <input 
                        type="number" id="weeklyTargetInput" value={newTargetInput}
                        onChange={(e) => setNewTargetInput(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 text-md"
                        disabled={isUpdatingTarget || isLoading} min="1"
                    />
                    <Button type="submit" variant="secondary" className="py-2 px-4 text-sm" disabled={isUpdatingTarget || isLoading}>
                        {isUpdatingTarget ? "Saving..." : "Set"}
                    </Button>
                </div>
                <Button onClick={() => logWeekAndResetBoard(false)} variant="danger" className="w-full" disabled={isLoading || isProcessingWeek || isUpdatingRecord}>
                    {isProcessingWeek ? 'Processing...' : 'Finalize Week & Reset Board'}
                </Button>
            </form>
        </Card>
    );
};

const InputPage = () => { /* ... same InputPage structure as before ... */ 
    const { 
        addProject, salespersons, projectTypes, setCurrentPage, isLoading, 
        isProcessingWeek, locationsData: locations, loggedProjects
    } = useContext(AppContext) || {}; 

    const [selectedSalesperson, setSelectedSalesperson] = useState(''); 
    const [draggingOverBucket, setDraggingOverBucket] = useState(null);
    const [congratsData, setCongratsData] = useState({ show: false, name: '', project: '', location: '' });

    const safeLocations = locations || {};

    const handleDragStart = (e, projectId) => e.dataTransfer.setData('projectId', projectId);

    const handleDrop = async (e, locationId) => {
        e.preventDefault();
        setDraggingOverBucket(null);
        const projectId = e.dataTransfer.getData('projectId');
        if (selectedSalesperson && projectId && locationId) {
            const success = await addProject(selectedSalesperson, projectId, locationId);
            if (success) {
                const SProject = projectTypes.find(pt => pt.id === projectId);
                const SPerson = salespersons.find(sp => sp.id === selectedSalesperson);
                setCongratsData({
                    show: true,
                    name: SPerson ? SPerson.name : 'Valued Team Member',
                    project: SProject ? SProject.name : 'a project',
                    location: safeLocations[locationId.toUpperCase()]?.name || locationId 
                });
                triggerConfetti(150);
                setTimeout(() => setCongratsData({ show: false, name: '', project: '', location: '' }), 3000);
            }
        } else if (!selectedSalesperson) {
            alert("Please select a salesperson first.");
        }
    };

    const handleDragOver = (e, locationId) => { e.preventDefault(); setDraggingOverBucket(locationId); };
    const handleDragLeave = () => setDraggingOverBucket(null);
    const getProjectCountForLocation = (locationId) => loggedProjects.filter(p => p.location === locationId).length;

    const salespersonStats = SALESPERSONS.map(sp => ({
        ...sp,
        projectCount: loggedProjects.filter(p => p.salespersonId === sp.id).length
    })).sort((a, b) => b.projectCount - a.projectCount);

    if (!locations) { 
        return <LoadingSpinner message="Initializing app data..." />;
    }

    return (
        <div className="container mx-auto p-4 md:p-6 max-w-screen-xl"> 
            {congratsData.show && ( 
                <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[10000] p-4">
                    <div className="bg-white p-6 sm:p-10 rounded-xl shadow-2xl text-center max-w-md w-full">
                        <span role="img" aria-label="gift" className="text-6xl sm:text-7xl mb-4 inline-block animate-bounce">🎉</span> 
                        <h2 className="text-3xl sm:text-4xl font-bold text-blue-600 mb-3">CONGRATS</h2>
                        <p className="text-2xl sm:text-3xl text-gray-800 mb-2"><span className="font-semibold">{congratsData.name}</span>!</p>
                        <p className="text-md sm:text-lg text-gray-600">You successfully logged <span className="font-semibold">{congratsData.project}</span> in {congratsData.location}.</p>
                    </div>
                </div>
            )}
            
            <div className="mb-6 lg:mb-8">
                <Card> 
                    <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
                        <h1 className="text-3xl md:text-4xl font-bold text-gray-800">Log New Project</h1>
                        <Button onClick={() => setCurrentPage('display')} variant="secondary" disabled={isLoading || isProcessingWeek}>View Display Board</Button>
                    </div>
                    {isLoading && !isProcessingWeek && <LoadingSpinner message="Connecting to Database..." />}
                    <div className="mb-6">
                        <label htmlFor="salesperson" className="block text-lg font-medium text-gray-700 mb-2">Salesperson:</label>
                        <select id="salesperson" value={selectedSalesperson} onChange={(e) => setSelectedSalesperson(e.target.value)}
                            className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 text-lg" disabled={isLoading || isProcessingWeek} required>
                            <option value="" disabled>Select Salesperson</option>
                            {salespersons.map(sp => <option key={sp.id} value={sp.id}>{sp.name}</option>)}
                        </select>
                    </div>
                    <div className="mb-6">
                        <h2 className="text-xl font-semibold text-gray-700 mb-3">Available Projects (Drag to Location):</h2>
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                            {projectTypes.map(pt => <ProjectIcon key={pt.id} project={pt} onDragStart={handleDragStart} />)}
                        </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4 md:gap-6">
                        <LocationBucket locationDetails={safeLocations.REGINA} onDrop={handleDrop} onDragOver={(e) => handleDragOver(e, safeLocations.REGINA.id)} onDragLeave={handleDragLeave} isOver={draggingOverBucket === safeLocations.REGINA.id} projectCount={getProjectCountForLocation(safeLocations.REGINA.id)} />
                        <LocationBucket locationDetails={safeLocations.SASKATOON} onDrop={handleDrop} onDragOver={(e) => handleDragOver(e, safeLocations.SASKATOON.id)} onDragLeave={handleDragLeave} isOver={draggingOverBucket === safeLocations.SASKATOON.id} projectCount={getProjectCountForLocation(safeLocations.SASKATOON.id)} />
                    </div>
                </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
                <div> 
                    <WeeklyLogDisplay />
                </div>
                <div> 
                    <Card className="bg-gray-50 h-full"> 
                        <h2 className="text-2xl font-semibold text-gray-700 mb-4 text-center">Salesperson Leaderboard</h2>
                        {isLoading && salespersonStats.length === 0 ? <LoadingSpinner message="Loading leaderboard..." /> : salespersonStats.length > 0 ? (
                            <ul className="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto pr-2"> 
                                {salespersonStats.map((sp, index) => (
                                    <li key={sp.id} className={`p-3 rounded-lg shadow flex justify-between items-center text-gray-700 ${index === 0 ? 'bg-yellow-100 border-yellow-400' : index === 1 ? 'bg-gray-200 border-gray-400' : index === 2 ? 'bg-orange-100 border-orange-400' : 'bg-white border-gray-300'}`}>
                                        <span className="font-medium text-lg">{index + 1}. {sp.name} {index === 0 && '🥇'} {index === 1 && '🥈'} {index === 2 && '🥉'}</span>
                                        <span className="font-bold text-xl">{sp.projectCount}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : ( <p className="text-gray-600 text-center py-4">No projects logged yet.</p> )}
                    </Card>
                </div>
            </div>
        </div>
    );
};

const ProjectGridCell = ({ project, locationMap }) => { /* ... same as before ... */ 
    const safeLocationMap = locationMap || {};
    const locationDetails = Object.values(safeLocationMap).find(loc => loc.id === project.location);
    const tileBgColor = locationDetails ? locationDetails.tileColor : 'bg-gray-100/80 border-gray-400';

    return ( 
        <div className={`aspect-square shadow-lg rounded-lg flex flex-col items-center justify-center p-1.5 sm:p-2 text-center border ${tileBgColor} hover:shadow-xl transition-shadow`}>
            <div className="w-[80%] h-[80%] flex items-center justify-center">
                {isIconUrl(project.projectIcon) ? (
                    <img src={project.projectIcon} alt={project.projectName}
                         className="max-w-full max-h-full object-contain"
                         onError={(e) => { e.target.src='https://placehold.co/64x64/cccccc/969696?text=FAIL'; e.target.alt='Error'; }}/>
                ) : (
                    <span className="text-5xl sm:text-6xl md:text-7xl lg:text-7xl" style={{lineHeight: 1}}>{project.projectIcon}</span>
                )}
            </div>
            <div className="w-full text-center mt-auto pt-0.5">
                <p className="text-sm sm:text-lg font-semibold text-gray-800 truncate px-1">{project.salespersonName}</p>
                {locationDetails && <p className="text-xs sm:text-base text-gray-700">{locationDetails.abbreviation}</p>}
            </div>
        </div>
    );
};
const DisplayPage = () => { /* ... same as before ... */ 
    const { 
        loggedProjects, weeklyGoal, setCurrentPage, isLoading, 
        isProcessingWeek, locationsData: locations 
    } = useContext(AppContext) || {}; 

    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const safeLocations = locations || {};
    const projectsToDisplay = loggedProjects.slice(0, weeklyGoal); 
    const emptyCellsCount = Math.max(0, weeklyGoal - projectsToDisplay.length);
    
    const numColumns = 6; 

    if (!locations) { 
        return <LoadingSpinner message="Initializing display data..." />;
    }

    return ( 
        <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white p-2 sm:p-4 md:p-6 flex flex-col items-center justify-center">
            <div className="w-full max-w-[2560px] h-full flex flex-col">
                <header className="w-full mb-2 md:mb-4 text-center py-1 sm:py-2">
                    <div className="flex justify-between items-center mb-2 sm:mb-3 px-2">
                        <img src="TUDS Logo Colour.png" alt="TUDS Logo" 
                             className="h-16 sm:h-20 md:h-24 rounded"
                             onError={(e) => {e.target.onerror=null; e.target.src='https://placehold.co/200x60/CCCCCC/FFFFFF?text=TUDS+Logo'}}/>
                        <div className="text-right">
                            <p className="text-md sm:text-lg md:text-xl font-medium text-gray-300">
                                {currentTime.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}
                            </p>
                            <p className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-100">
                                {currentTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                            </p>
                        </div>
                    </div>
                    <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-teal-400 to-green-400 leading-tight px-1">
                        Customer Projects This Week!
                    </h1>
                    <p className="mt-1 text-2xl sm:text-3xl md:text-4xl font-bold text-yellow-400">
                        {loggedProjects.length} <span className="text-xl sm:text-2xl text-gray-300">of</span> {weeklyGoal} <span className="text-xl sm:text-2xl text-gray-300">Done!</span>
                    </p>
                    {loggedProjects.length >= weeklyGoal && (
                        <p className="mt-1 text-xl sm:text-2xl text-green-400 animate-pulse">🎉 Goal Achieved! 🎉</p>
                    )}
                </header>
                <main className="w-full flex-grow flex items-center justify-center px-1 sm:px-2">
                    {(isLoading && loggedProjects.length === 0) && <LoadingSpinner message="Loading Projects..." />}
                    {!isLoading && (
                        <div className={`grid gap-1 sm:gap-1.5 md:gap-2 w-full`} style={{gridTemplateColumns: `repeat(${numColumns}, minmax(0, 1fr))`}}>
                            {projectsToDisplay.map(proj => (
                                <ProjectGridCell key={proj.id} project={proj} locationMap={safeLocations} /> 
                            ))}
                            {Array.from({ length: emptyCellsCount }).map((_, idx) => (
                                <div key={`empty_${idx}`} className="aspect-square bg-slate-800/70 rounded-lg opacity-60"></div>
                            ))}
                        </div>
                    )}
                    { !isLoading && loggedProjects.length === 0 && emptyCellsCount === weeklyGoal && (
                        <div className="text-center py-10">
                            <p className="text-2xl sm:text-3xl text-gray-400">No projects logged yet for this week.</p>
                        </div>
                    )}
                </main>
                <footer className="w-full mt-2 md:mt-4 text-center py-1 sm:py-2">
                    <Button onClick={() => setCurrentPage('input')} variant="secondary" className="mr-2 sm:mr-4 text-xs sm:text-sm" disabled={isLoading || isProcessingWeek}>
                        Input Page
                    </Button>
                </footer>
            </div>
        </div>
    );
};
function App() { /* ... same as before ... */ 
    const appContextValue = useContext(AppContext); 
    if (!appContextValue) {
        return <LoadingSpinner message="Initializing Application..." />; 
    }
    const { currentPage } = appContextValue; 

    useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash;
            if (appContextValue && appContextValue.setCurrentPage) {
                if (hash === '#/display') appContextValue.setCurrentPage('display');
                else if (hash === '#/input' || hash === '') appContextValue.setCurrentPage('input');
            }
        };
        window.addEventListener('hashchange', handleHashChange, false);
        handleHashChange();
        return () => window.removeEventListener('hashchange', handleHashChange, false);
    }, [appContextValue]); 

    return (
        <div className="min-h-screen bg-gray-100 font-sans">
            {currentPage === 'input' ? <InputPage /> : <DisplayPage />}
        </div>
    );
}
export default function ProvidedApp() { /* ... same as before ... */ 
  return (
    <AppProvider>
      <App />
    </AppProvider>
  );
}
