import React, { useState, useEffect, createContext, useContext } from 'react';
import { db } from './firebase'; // Make sure firebase.js is in the src folder
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, deleteDoc, doc, getDocs, writeBatch } from "firebase/firestore"; // Added doc for individual deletion

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
    { id: 'sam', name: 'Sam', initials: 'SA' }, // Added Sam
].sort((a, b) => a.name.localeCompare(b.name));

const PROJECT_TYPES = [
    { id: 'railing', name: 'Railing', icon: 'railing.png' },
    { id: 'deck', name: 'Deck', icon: 'deck.png' },
    { id: 'hardscapes', name: 'Hardscapes', icon: 'hardscapes.png' },
    { id: 'fence', name: 'Fence', icon: 'fence.png' },
    { id: 'pergola', name: 'Pergola', icon: 'pergola.png' },
    { id: 'turf', name: 'Turf', icon: 'turf.png' },
];

const WEEKLY_GOAL = 60; // Renamed from MONTHLY_GOAL

const PROJECTS_COLLECTION = 'projects';
const WEEKLY_RECORDS_COLLECTION = 'weeklyRecords'; // New collection for weekly logs

const LOCATIONS = {
    REGINA: { id: 'regina', name: 'Regina', abbreviation: 'RGNA', tileColor: 'bg-blue-100/80 border-blue-400', bucketColor: 'border-blue-400 bg-blue-50 hover:bg-blue-100', textColor: 'text-blue-700', bucketOverColor: 'border-blue-600 bg-blue-100 scale-105' },
    SASKATOON: { id: 'saskatoon', name: 'Saskatoon', abbreviation: 'SKTN', tileColor: 'bg-green-100/80 border-green-400', bucketColor: 'border-green-400 bg-green-50 hover:bg-green-100', textColor: 'text-green-700', bucketOverColor: 'border-green-600 bg-green-100 scale-105' }
};

// Helper function to check if the icon string is a URL or a local path
const isIconUrl = (iconString) => typeof iconString === 'string' && (iconString.startsWith('http') || iconString.startsWith('/') || iconString.includes('.'));

// --- Date Helper Functions ---
const formatDate = (date, options = { month: 'short', day: 'numeric' }) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString(undefined, options);
};

// Gets the Sunday of the week the given date falls into.
const getWeekEndDate = (dateForWeek) => {
    const date = new Date(dateForWeek);
    const day = date.getDay(); // 0 (Sunday) to 6 (Saturday)
    const diff = date.getDate() - day + (day === 0 ? 0 : 7); // Adjust to Sunday
    return new Date(date.setDate(diff));
};

// Gets the Monday of the week the given Sunday falls into.
const getWeekStartDate = (sundayEndDate) => {
    const startDate = new Date(sundayEndDate);
    startDate.setDate(sundayEndDate.getDate() - 6);
    return startDate;
};


// --- Context for Application State ---
const AppContext = createContext();

const AppProvider = ({ children }) => {
    const [loggedProjects, setLoggedProjects] = useState([]);
    const [weeklyRecords, setWeeklyRecords] = useState([]); // State for weekly logs
    const [currentPage, setCurrentPage] = useState('input');
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessingWeek, setIsProcessingWeek] = useState(false); // For loading state of log/reset

    // Effect to set initial page based on hash or localStorage
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

    // Effect to subscribe to Firebase project and weekly record updates
    useEffect(() => {
        setIsLoading(true);
        const projectsQuery = query(collection(db, PROJECTS_COLLECTION), orderBy('timestamp', 'desc'));
        const recordsQuery = query(collection(db, WEEKLY_RECORDS_COLLECTION), orderBy('weekEndDate', 'desc'));

        const unsubscribeProjects = onSnapshot(projectsQuery, (querySnapshot) => {
            const projectsData = querySnapshot.docs.map(pDoc => ({ ...pDoc.data(), id: pDoc.id }));
            setLoggedProjects(projectsData);
            // Check for auto-reset after projects are loaded
            handleAutoSundayReset(projectsData); 
        }, (error) => {
            console.error("Error fetching projects: ", error);
            alert("Could not fetch project data.");
        });

        const unsubscribeRecords = onSnapshot(recordsQuery, (querySnapshot) => {
            const recordsData = querySnapshot.docs.map(rDoc => ({ ...rDoc.data(), id: rDoc.id }));
            setWeeklyRecords(recordsData);
        }, (error) => {
            console.error("Error fetching weekly records: ", error);
            alert("Could not fetch weekly records.");
        });
        
        // Combined loading state management
        Promise.all([
            getDocs(projectsQuery), // Initial fetch to help determine loading
            getDocs(recordsQuery)
        ]).finally(() => setIsLoading(false));


        return () => {
            unsubscribeProjects();
            unsubscribeRecords();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // handleAutoSundayReset dependency will be managed internally or via useCallback if needed

    const handleSetCurrentPage = (page) => {
        setCurrentPage(page);
        localStorage.setItem('salesTrackerCurrentPage', page);
        window.location.hash = page === 'display' ? '#/display' : '#/input';
    };

    const addProjectToFirebase = async (salespersonId, projectTypeId, locationId) => {
        // ... (same as before)
        const salesperson = SALESPERSONS.find(s => s.id === salespersonId);
        const projectType = PROJECT_TYPES.find(p => p.id === projectTypeId);
        const location = LOCATIONS[locationId.toUpperCase()];

        if (!salesperson || !projectType || !location) {
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
                location: location.id,
                timestamp: serverTimestamp(),
            });
            return true;
        } catch (error) {
            console.error("Error adding project: ", error);
            alert("Error logging project. Please check console for details.");
            return false;
        }
    };

    const deleteAllProjectsFromBoard = async () => {
        // Deletes all projects from the PROJECTS_COLLECTION
        const projectsQuerySnapshot = await getDocs(collection(db, PROJECTS_COLLECTION));
        if (projectsQuerySnapshot.empty) return;

        const batch = writeBatch(db);
        projectsQuerySnapshot.docs.forEach(pDoc => {
            batch.delete(doc(db, PROJECTS_COLLECTION, pDoc.id));
        });
        await batch.commit();
    };
    
    const logWeekAndResetBoard = async (isAuto = false) => {
        if (!isAuto && !window.confirm("This will log the current week's project count, save it, and then clear the display board. Are you sure?")) {
            return;
        }
        setIsProcessingWeek(true);
        try {
            const today = new Date();
            const weekEnd = getWeekEndDate(today); // Sunday of the current week (or week just ended if it's Sunday)
            const weekStart = getWeekStartDate(weekEnd);
            
            const weekDisplay = `${formatDate(weekStart)} - ${formatDate(weekEnd)}`;
            const completed = loggedProjects.length; // All current projects are counted

            const newRecord = {
                weekDisplay,
                completed,
                target: WEEKLY_GOAL,
                weekEndDate: weekEnd.toISOString(), // Store as ISO string for easier querying/sorting
                loggedAt: serverTimestamp()
            };

            await addDoc(collection(db, WEEKLY_RECORDS_COLLECTION), newRecord);
            await deleteAllProjectsFromBoard();
            // No need to call setLoggedProjects([]) as onSnapshot will update it.
            // Fetching weeklyRecords is also handled by its onSnapshot.

            if (!isAuto) alert("Current projects logged for the week and display board has been reset.");
            else console.log("Weekly projects automatically logged and board reset.");

        } catch (error) {
            console.error("Error logging week and resetting board: ", error);
            alert("An error occurred while logging the week and resetting the board.");
        } finally {
            setIsProcessingWeek(false);
        }
    };

    const handleAutoSundayReset = async (currentProjects) => {
        const today = new Date();
        if (today.getDay() === 0) { // It's Sunday
            const todayISO = today.toISOString().split('T')[0]; // YYYY-MM-DD
            const lastAutoResetSunday = localStorage.getItem('lastAutoResetSunday');

            if (lastAutoResetSunday !== todayISO) {
                // Only proceed if there are projects to log for the week ending today
                if (currentProjects && currentProjects.length > 0) { 
                    console.log("Attempting automatic Sunday log and reset...");
                    await logWeekAndResetBoard(true); // Pass true for automatic, no confirm
                    localStorage.setItem('lastAutoResetSunday', todayISO);
                } else {
                    // If no projects, still mark Sunday as processed to avoid re-check if app is opened multiple times
                    localStorage.setItem('lastAutoResetSunday', todayISO);
                    console.log("Automatic Sunday check: No projects to log, board is already clear or was cleared. Marked Sunday as processed.");
                }
            }
        }
    };


    return (
        <AppContext.Provider value={{ 
            loggedProjects, weeklyRecords, addProject: addProjectToFirebase, currentPage, 
            setCurrentPage: handleSetCurrentPage, weeklyGoal: WEEKLY_GOAL, 
            salespersons: SALESPERSONS, projectTypes: PROJECT_TYPES, 
            logWeekAndResetBoard, // Expose the new function
            isLoading, isProcessingWeek, locations
        }}>
            {children}
        </AppContext.Provider>
    );
};

// --- UI Components ---
// Card, Button, LoadingSpinner (same as before)
const Card = ({ children, className = '' }) => (
    <div className={`bg-white shadow-xl rounded-lg p-6 md:p-8 ${className}`}>
        {children}
    </div>
);

const Button = ({ children, onClick, className = '', variant = 'primary', disabled = false }) => {
    const styles = {
        primary: 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500',
        secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-800 focus:ring-gray-400',
        danger: 'bg-red-500 hover:bg-red-600 text-white focus:ring-red-400',
    };
    return (
        <button onClick={onClick} disabled={disabled}
            className={`px-6 py-3 rounded-lg font-semibold shadow-md focus:outline-none focus:ring-2 focus:ring-opacity-75 transition-all ${styles[variant]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}>
            {children}
        </button>
    );
};

const LoadingSpinner = ({ message = "Loading..."}) => (
    <div className="flex flex-col items-center justify-center p-10 text-gray-700">
        <svg className="animate-spin h-10 w-10 text-blue-600 mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle>
          <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75"></path>
        </svg>
        <p className="text-lg">{message}</p>
    </div>
);

// Confetti (same as before)
const createConfettiPiece = () => {
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

const animateConfettiPiece = (piece) => {
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
const triggerConfetti = (count = 150) => {
    for (let i = 0; i < count; i++) {
        setTimeout(() => { const piece = createConfettiPiece(); animateConfettiPiece(piece); }, i * 15);
    }
};

// --- Input Page Components ---
// ProjectIcon, LocationBucket (same as before with larger icons in ProjectIcon)
const ProjectIcon = ({ project, onDragStart }) => (
    <div draggable onDragStart={(e) => onDragStart(e, project.id)}
        className="flex flex-col items-center justify-center p-1 sm:p-2 m-1 border-2 border-dashed border-gray-300 rounded-lg cursor-grab hover:bg-gray-100 transition-colors aspect-square"
        title={project.name}>
        {isIconUrl(project.icon) ? (
            <img 
                src={project.icon} // Assuming icons are in public folder
                alt={project.name} 
                className="w-20 h-20 sm:w-24 sm:h-24 object-contain pointer-events-none"
                onError={(e) => { e.target.src='https://placehold.co/64x64/cccccc/969696?text=IMG'; e.target.alt = 'Image not found'; }}
            />
        ) : (
            <span className="text-5xl sm:text-6xl pointer-events-none">{project.icon}</span>
        )}
    </div>
);

const LocationBucket = ({ locationDetails, onDrop, onDragOver, onDragLeave, isOver, projectCount }) => (
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

// New Component for Weekly Log Display
const WeeklyLogDisplay = () => {
    const { weeklyRecords, isLoading, weeklyGoal } = useContext(AppContext);

    if (isLoading && weeklyRecords.length === 0) { // Show loading only if records are empty initially
        return <LoadingSpinner message="Loading weekly records..." />;
    }

    return (
        <Card className="bg-gray-50 h-full"> {/* Added h-full for consistent height with leaderboard */}
            <h2 className="text-2xl font-semibold text-gray-700 mb-4 text-center">Weekly Performance</h2>
            {weeklyRecords.length > 0 ? (
                <ul className="space-y-2 max-h-96 overflow-y-auto pr-2"> {/* Added max-height and scroll */}
                    {weeklyRecords.map(record => (
                        <li key={record.id} className={`p-3 rounded-lg shadow text-gray-700 ${record.completed >= record.target ? 'bg-green-100 border-green-400' : 'bg-red-100 border-red-400'}`}>
                            <div className="flex justify-between items-center">
                                <span className="font-medium text-md">{record.weekDisplay}</span>
                                <span className={`font-bold text-lg ${record.completed >= record.target ? 'text-green-600' : 'text-red-600'}`}>
                                    {record.completed}/{record.target}
                                </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">
                                {record.completed >= record.target ? `Goal Met! 🎉 (+${record.completed - record.target})` : `Short by ${record.target - record.completed}`}
                            </p>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-gray-600 text-center py-4">No weekly records yet.</p>
            )}
        </Card>
    );
};


const InputPage = () => {
    const { addProject, salespersons, projectTypes, setCurrentPage, isLoading, isProcessingWeek, locations, loggedProjects, logWeekAndResetBoard } = useContext(AppContext);
    const [selectedSalesperson, setSelectedSalesperson] = useState(''); 
    const [draggingOverBucket, setDraggingOverBucket] = useState(null);
    const [congratsData, setCongratsData] = useState({ show: false, name: '', project: '', location: '' });

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
                    location: locations[locationId.toUpperCase()].name
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

    return (
        <div className="container mx-auto p-4 md:p-6 max-w-7xl"> {/* Increased max-width for new layout */}
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

            {/* Main content area: Project Logging and Leaderboards/WeeklyLog */}
            <div className="grid lg:grid-cols-2 gap-6 lg:gap-8">
                {/* Column 1: Project Logging */}
                <Card>
                    <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
                        <h1 className="text-3xl md:text-4xl font-bold text-gray-800">Log New Project</h1>
                        <Button onClick={() => setCurrentPage('display')} variant="secondary" disabled={isLoading || isProcessingWeek}>View Display Board</Button>
                    </div>
                    {isLoading && <LoadingSpinner message="Connecting to Database..." />}
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
                        <LocationBucket locationDetails={locations.REGINA} onDrop={handleDrop} onDragOver={(e) => handleDragOver(e, locations.REGINA.id)} onDragLeave={handleDragLeave} isOver={draggingOverBucket === locations.REGINA.id} projectCount={getProjectCountForLocation(locations.REGINA.id)} />
                        <LocationBucket locationDetails={locations.SASKATOON} onDrop={handleDrop} onDragOver={(e) => handleDragOver(e, locations.SASKATOON.id)} onDragLeave={handleDragLeave} isOver={draggingOverBucket === locations.SASKATOON.id} projectCount={getProjectCountForLocation(locations.SASKATOON.id)} />
                    </div>
                </Card>

                {/* Column 2: Leaderboard and Weekly Log */}
                <div className="space-y-6 lg:space-y-8">
                    <Card className="bg-gray-50">
                        <h2 className="text-2xl font-semibold text-gray-700 mb-4 text-center">Salesperson Leaderboard</h2>
                        {isLoading && salespersonStats.length === 0 ? <LoadingSpinner message="Loading leaderboard..." /> : salespersonStats.length > 0 ? (
                            <ul className="space-y-2 max-h-96 overflow-y-auto pr-2"> {/* Added max-height and scroll */}
                                {salespersonStats.map((sp, index) => (
                                    <li key={sp.id} className={`p-3 rounded-lg shadow flex justify-between items-center text-gray-700 ${index === 0 ? 'bg-yellow-100 border-yellow-400' : index === 1 ? 'bg-gray-200 border-gray-400' : index === 2 ? 'bg-orange-100 border-orange-400' : 'bg-white border-gray-300'}`}>
                                        <span className="font-medium text-lg">{index + 1}. {sp.name} {index === 0 && '🥇'} {index === 1 && '🥈'} {index === 2 && '🥉'}</span>
                                        <span className="font-bold text-xl">{sp.projectCount}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : ( <p className="text-gray-600 text-center py-4">No projects logged yet.</p> )}
                    </Card>
                    <WeeklyLogDisplay />
                </div>
            </div>
             {/* Admin action button at the bottom or in a separate admin section if preferred */}
             <div className="mt-8 text-center">
                <Button onClick={() => logWeekAndResetBoard(false)} variant="danger" disabled={isLoading || isProcessingWeek}>
                    {isProcessingWeek ? 'Processing...' : 'Finalize Week & Reset Board'}
                </Button>
            </div>
        </div>
    );
};


// --- Display Page Components ---
// ProjectGridCell, DisplayPage (mostly same as before, ensure numColumns is 6 for DisplayPage)
const ProjectGridCell = ({ project, locationMap }) => {
    const locationDetails = Object.values(locationMap).find(loc => loc.id === project.location);
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

const DisplayPage = () => {
    const { loggedProjects, weeklyGoal, setCurrentPage, isLoading, isProcessingWeek, locations, logWeekAndResetBoard } = useContext(AppContext); // Added logWeekAndResetBoard for admin footer
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const projectsToDisplay = loggedProjects.slice(0, weeklyGoal); 
    const emptyCellsCount = Math.max(0, weeklyGoal - projectsToDisplay.length);
    const numColumns = 10; // For 60 items, 10 columns = 6 rows. Or 12 columns = 5 rows. Adjust as needed.
                           // Or make it dynamic: Math.ceil(Math.sqrt(weeklyGoal * (aspect_ratio_width/aspect_ratio_height)))
                           // For approx square cells with 60 items, sqrt(60) is ~7.7. So 8 columns might be good (8x8=64).
                           // Let's try 10 columns for 60 items to get 6 rows.
                           // const numColumns = Math.ceil(weeklyGoal / 6); // If you want exactly 6 rows

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white p-2 sm:p-4 md:p-6 flex flex-col items-center justify-center">
            <div className="w-full max-w-[2560px] h-full flex flex-col"> {/* Max width for very large displays */}
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
                                <ProjectGridCell key={proj.id} project={proj} locationMap={locations} />
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
                    {/* The admin reset button is now primarily on the InputPage for better context */}
                </footer>
            </div>
        </div>
    );
};

// --- Main Application Component ---
function App() {
    const { currentPage, setCurrentPage: contextSetCurrentPage } = useContext(AppContext);

    useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash;
            if (contextSetCurrentPage) {
                if (hash === '#/display') contextSetCurrentPage('display');
                else if (hash === '#/input' || hash === '') contextSetCurrentPage('input');
            }
        };
        window.addEventListener('hashchange', handleHashChange, false);
        handleHashChange();
        return () => window.removeEventListener('hashchange', handleHashChange, false);
    }, [contextSetCurrentPage]);

    return (
        <div className="min-h-screen bg-gray-100 font-sans">
            {currentPage === 'input' ? <InputPage /> : <DisplayPage />}
        </div>
    );
}

export default function ProvidedApp() {
  return (
    <AppProvider>
      <App />
    </AppProvider>
  );
}
