import React, { useState, useEffect, createContext, useContext } from 'react';
import { db } from './firebase'; // Make sure firebase.js is in the src folder
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, deleteDoc, getDocs } from "firebase/firestore";

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
].sort((a, b) => a.name.localeCompare(b.name));

const PROJECT_TYPES = [
    { id: 'railing', name: 'Railing', icon: 'railing.png' },
    { id: 'deck', name: 'Deck', icon: 'deck.png' },
    { id: 'hardscapes', name: 'Hardscapes', icon: 'hardscapes.png' },
    { id: 'fence', name: 'Fence', icon: 'fence.png' },
    { id: 'pergola', name: 'Pergola', icon: 'pergola.png' },
    { id: 'turf', name: 'Turf', icon: 'turf.png' },
];

const MONTHLY_GOAL = 60;

const PROJECTS_COLLECTION = 'projects';
const LOCATIONS = {
    REGINA: { id: 'regina', name: 'Regina', abbreviation: 'RGNA', tileColor: 'bg-blue-100/80 border-blue-400', bucketColor: 'border-blue-400 bg-blue-50 hover:bg-blue-100', textColor: 'text-blue-700', bucketOverColor: 'border-blue-600 bg-blue-100 scale-105' },
    SASKATOON: { id: 'saskatoon', name: 'Saskatoon', abbreviation: 'SKTN', tileColor: 'bg-green-100/80 border-green-400', bucketColor: 'border-green-400 bg-green-50 hover:bg-green-100', textColor: 'text-green-700', bucketOverColor: 'border-green-600 bg-green-100 scale-105' }
};

// Helper function to check if the icon string is a URL
const isIconUrl = (iconString) => typeof iconString === 'string' && (iconString.startsWith('http') || iconString.startsWith('/') || iconString.includes('.'));

// --- Context for Application State ---
const AppContext = createContext();

const AppProvider = ({ children }) => {
    const [loggedProjects, setLoggedProjects] = useState([]);
    const [currentPage, setCurrentPage] = useState('input'); // Default to input page
    const [isLoading, setIsLoading] = useState(true);

    // Effect to set initial page based on hash or localStorage
    useEffect(() => {
        const getInitialPage = () => {
            const hash = window.location.hash;
            if (hash === '#/display') return 'display';
            if (hash === '#/input') return 'input';
            const storedPage = localStorage.getItem('salesTrackerCurrentPage');
            return storedPage === 'display' ? 'display' : 'input'; // Default to input if not display
        };
        setCurrentPage(getInitialPage());
    }, []);

    // Effect to subscribe to Firebase project updates
    useEffect(() => {
        setIsLoading(true);
        const q = query(collection(db, PROJECTS_COLLECTION), orderBy('timestamp', 'desc'));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const projectsData = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
            setLoggedProjects(projectsData);
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching projects: ", error);
            // Avoid using alert for better UX, consider a toast or inline message
            // For now, keeping alert as per original code's error handling style
            alert("Could not fetch project data. Please check console for errors.");
            setIsLoading(false);
        });
        return () => unsubscribe(); // Cleanup subscription on unmount
    }, []);

    // Function to handle page changes and update localStorage/hash
    const handleSetCurrentPage = (page) => {
        setCurrentPage(page);
        localStorage.setItem('salesTrackerCurrentPage', page);
        window.location.hash = page === 'display' ? '#/display' : '#/input';
    };

    // Function to add a project to Firebase
    const addProjectToFirebase = async (salespersonId, projectTypeId, locationId) => {
        const salesperson = SALESPERSONS.find(s => s.id === salespersonId);
        const projectType = PROJECT_TYPES.find(p => p.id === projectTypeId);
        const location = LOCATIONS[locationId.toUpperCase()]; // Ensure locationId matches keys in LOCATIONS

        if (!salesperson || !projectType || !location) {
            alert("Error: Invalid salesperson, project type, or location selected.");
            return false; // Indicate failure
        }
        try {
            await addDoc(collection(db, PROJECTS_COLLECTION), {
                salespersonId,
                salespersonInitials: salesperson.initials,
                salespersonName: salesperson.name,
                projectTypeId,
                projectIcon: projectType.icon, // Store the icon string (URL or emoji)
                projectName: projectType.name,
                location: location.id, // Store location ID (e.g., 'regina')
                timestamp: serverTimestamp(),
            });
            return true; // Indicate success
        } catch (error) {
            console.error("Error adding project: ", error);
            alert("Error logging project. Please check console for details.");
            return false; // Indicate failure
        }
    };
    
    // Function to reset all project data in Firebase
    const resetMonthlyDataInFirebase = async () => {
        if (window.confirm("ARE YOU SURE you want to RESET ALL PROJECT DATA? This action cannot be undone.")) {
            setIsLoading(true);
            try {
                const projectsQuerySnapshot = await getDocs(collection(db, PROJECTS_COLLECTION));
                const deletePromises = projectsQuerySnapshot.docs.map(doc => deleteDoc(doc.ref));
                await Promise.all(deletePromises);
                alert("All project data has been successfully reset.");
            } catch (error) {
                console.error("Error resetting data: ", error);
                alert("An error occurred while resetting data. Please check the console.");
            } finally {
                setIsLoading(false);
            }
        }
    };

    // Provide state and functions to child components
    return (
        <AppContext.Provider value={{ 
            loggedProjects, addProject: addProjectToFirebase, currentPage, 
            setCurrentPage: handleSetCurrentPage, monthlyGoal: MONTHLY_GOAL, 
            salespersons: SALESPERSONS, projectTypes: PROJECT_TYPES, 
            resetMonthlyData: resetMonthlyDataInFirebase, isLoading, locations: LOCATIONS
        }}>
            {children}
        </AppContext.Provider>
    );
};

// --- UI Components ---

// Generic Card component for styling content blocks
const Card = ({ children, className = '' }) => (
    <div className={`bg-white shadow-xl rounded-lg p-6 md:p-8 ${className}`}>
        {children}
    </div>
);

// Generic Button component with variants
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

// Loading spinner component
const LoadingSpinner = ({ message = "Loading..."}) => (
    <div className="flex flex-col items-center justify-center p-10 text-gray-700">
        <svg className="animate-spin h-10 w-10 text-blue-600 mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle>
          <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75"></path>
        </svg>
        <p className="text-lg">{message}</p>
    </div>
);

// --- Confetti Effect (DOM based) ---
const createConfettiPiece = () => {
    const piece = document.createElement('div');
    piece.style.position = 'fixed';
    piece.style.left = `${Math.random() * 100}vw`;
    piece.style.top = `${Math.random() * -20 - 10}vh`; // Start further above screen
    piece.style.width = `${Math.random() * 12 + 6}px`; // Slightly larger pieces
    piece.style.height = piece.style.width;
    piece.style.backgroundColor = `hsl(${Math.random() * 360}, 100%, 60%)`; // Brighter colors
    piece.style.opacity = '0'; // Start invisible
    piece.style.zIndex = '10001';
    piece.style.borderRadius = `${Math.random() > 0.5 ? '50%' : '0px'}`; // Mix of circles and squares
    piece.style.transform = `rotate(${Math.random() * 360}deg)`;
    document.body.appendChild(piece);
    return piece;
};

const animateConfettiPiece = (piece) => {
    const fallDuration = Math.random() * 3 + 2.5; // 2.5 to 5.5 seconds (more exciting)
    const swayAmount = Math.random() * 200 - 100; // -100 to 100 vw for horizontal sway (more exciting)
    const rotation = Math.random() * 720 + 360; // More rotation

    piece.animate([
        { transform: `translate3d(0, 0, 0) rotate(${piece.style.transform.match(/\d+/)[0]}deg)`, opacity: 1 }, // Use initial rotation
        { transform: `translate3d(${swayAmount}px, 110vh, 0) rotate(${rotation}deg)`, opacity: 0 }
    ], {
        duration: fallDuration * 1000,
        easing: 'ease-out',
        iterations: 1
    });

    setTimeout(() => {
        if (piece.parentNode) {
            piece.parentNode.removeChild(piece);
        }
    }, fallDuration * 1000);
};

const triggerConfetti = (count = 150) => { // Increased default count for more excitement
    for (let i = 0; i < count; i++) {
        setTimeout(() => {
            const piece = createConfettiPiece();
            animateConfettiPiece(piece);
        }, i * 15); // Stagger creation slightly more
    }
};

// --- Input Page Components ---

// Draggable Project Icon
const ProjectIcon = ({ project, onDragStart }) => (
    <div draggable onDragStart={(e) => onDragStart(e, project.id)}
        className="flex flex-col items-center justify-center p-2 m-1 border-2 border-dashed border-gray-300 rounded-lg cursor-grab hover:bg-gray-100 transition-colors aspect-square"
        title={project.name}> {/* Tooltip for project name */}
        {isIconUrl(project.icon) ? (
            <img src={project.icon} alt={project.name} className="w-12 h-12 sm:w-16 sm:h-16 object-contain pointer-events-none" 
                 onError={(e) => { e.target.style.display='none'; /* Hide if image fails */ }}/>
        ) : (
            <span className="text-4xl sm:text-5xl pointer-events-none">{project.icon}</span>
        )}
        {/* Project name text below icon is removed as per original code */}
    </div>
);

// Drop Zone for Location
const LocationBucket = ({ locationDetails, onDrop, onDragOver, onDragLeave, isOver, projectCount }) => (
    <div onDrop={(e) => onDrop(e, locationDetails.id)} onDragOver={onDragOver} onDragLeave={onDragLeave}
        className={`mt-6 p-6 md:p-8 border-4 border-dashed rounded-xl text-center transition-all duration-200 ease-in-out min-h-[150px] flex flex-col justify-center items-center
                  ${isOver ? locationDetails.bucketOverColor : locationDetails.bucketColor}`}>
        <h3 className={`text-xl font-semibold mb-2 ${locationDetails.textColor}`}>{locationDetails.name} Projects</h3>
        {/* Using a generic box icon as an example */}
        <svg className={`w-12 h-12 mb-2 ${isOver ? locationDetails.textColor : locationDetails.textColor } opacity-70`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
        <p className={`text-md font-medium ${locationDetails.textColor}`}>
            {isOver ? "Release to log!" : "Drag Project Here"}
        </p>
        <p className={`text-sm ${locationDetails.textColor} opacity-80`}>{projectCount} logged</p>
    </div>
);

// Main Input Page
const InputPage = () => {
    const { addProject, salespersons, projectTypes, setCurrentPage, isLoading, locations, loggedProjects } = useContext(AppContext);
    const [selectedSalesperson, setSelectedSalesperson] = useState(''); 
    const [draggingOverBucket, setDraggingOverBucket] = useState(null); // Tracks which bucket is being dragged over
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
                triggerConfetti(150); // Trigger more exciting confetti
                setTimeout(() => setCongratsData({ show: false, name: '', project: '', location: '' }), 3000); // Show for 3 seconds
            }
        } else if (!selectedSalesperson) {
            alert("Please select a salesperson first.");
        }
    };

    const handleDragOver = (e, locationId) => {
        e.preventDefault(); // Necessary to allow dropping
        setDraggingOverBucket(locationId);
    };
    
    const handleDragLeave = () => setDraggingOverBucket(null);

    // Helper to get project count for a specific location
    const getProjectCountForLocation = (locationId) => loggedProjects.filter(p => p.location === locationId).length;

    // Calculate salesperson stats for leaderboard
    const salespersonStats = SALESPERSONS.map(sp => ({
        ...sp,
        projectCount: loggedProjects.filter(p => p.salespersonId === sp.id).length
    })).sort((a, b) => b.projectCount - a.projectCount); // Sort by project count descending

    return (
        <div className="container mx-auto p-4 md:p-6 max-w-5xl">
            {/* Congrats Popup */}
            {congratsData.show && (
                <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[10000] p-4">
                    <div className="bg-white p-6 sm:p-10 rounded-xl shadow-2xl text-center max-w-md w-full">
                        <span role="img" aria-label="gift" className="text-6xl sm:text-7xl mb-4 inline-block animate-bounce">🎉</span> 
                        <h2 className="text-3xl sm:text-4xl font-bold text-blue-600 mb-3">CONGRATS</h2>
                        <p className="text-2xl sm:text-3xl text-gray-800 mb-2">
                            <span className="font-semibold">{congratsData.name}</span>!
                        </p>
                        <p className="text-md sm:text-lg text-gray-600">
                            You successfully logged <span className="font-semibold">{congratsData.project}</span> in {congratsData.location}.
                        </p>
                    </div>
                </div>
            )}

            <Card>
                <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
                    <h1 className="text-3xl md:text-4xl font-bold text-gray-800">Log New Project</h1>
                    <Button onClick={() => setCurrentPage('display')} variant="secondary" disabled={isLoading}>View Display Board</Button>
                </div>

                {isLoading && <LoadingSpinner message="Connecting to Database..." />}
                
                {/* This is the old success message, can be removed if congrats popup is preferred */}
                {/* {showSuccessMessage.show && ( ... )} */}


                <div className="mb-6">
                    <label htmlFor="salesperson" className="block text-lg font-medium text-gray-700 mb-2">Salesperson:</label>
                    <select id="salesperson" value={selectedSalesperson} onChange={(e) => setSelectedSalesperson(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 text-lg" disabled={isLoading} required>
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
                    <LocationBucket 
                        locationDetails={locations.REGINA} onDrop={handleDrop} 
                        onDragOver={(e) => handleDragOver(e, locations.REGINA.id)} onDragLeave={handleDragLeave}
                        isOver={draggingOverBucket === locations.REGINA.id} projectCount={getProjectCountForLocation(locations.REGINA.id)}
                    />
                    <LocationBucket 
                        locationDetails={locations.SASKATOON} onDrop={handleDrop} 
                        onDragOver={(e) => handleDragOver(e, locations.SASKATOON.id)} onDragLeave={handleDragLeave}
                        isOver={draggingOverBucket === locations.SASKATOON.id} projectCount={getProjectCountForLocation(locations.SASKATOON.id)}
                    />
                </div>
            </Card>

            {/* Leaderboards Section */}
            {!isLoading && (
            <div className="mt-8 grid md:grid-cols-2 gap-6">
                <Card className="bg-gray-50">
                    <h2 className="text-2xl font-semibold text-gray-700 mb-4 text-center">Location Totals</h2>
                    {/* Updated to display Regina and Saskatoon side-by-side */}
                    <div className="grid sm:grid-cols-2 gap-3 space-y-3 sm:space-y-0">
                        <div className={`p-4 rounded-lg shadow ${locations.REGINA.bucketColor} ${locations.REGINA.textColor}`}>
                            <h3 className="text-lg font-medium">{locations.REGINA.name}:</h3>
                            <p className="text-3xl font-bold">{getProjectCountForLocation(locations.REGINA.id)}</p>
                        </div>
                        <div className={`p-4 rounded-lg shadow ${locations.SASKATOON.bucketColor} ${locations.SASKATOON.textColor}`}>
                            <h3 className="text-lg font-medium">{locations.SASKATOON.name}:</h3>
                            <p className="text-3xl font-bold">{getProjectCountForLocation(locations.SASKATOON.id)}</p>
                        </div>
                    </div>
                </Card>
                <Card className="bg-gray-50">
                    <h2 className="text-2xl font-semibold text-gray-700 mb-4 text-center">Salesperson Leaderboard</h2>
                    {salespersonStats.length > 0 ? (
                        <ul className="space-y-2">
                            {salespersonStats.map((sp, index) => (
                                <li key={sp.id} className={`p-3 rounded-lg shadow flex justify-between items-center text-gray-700 ${index === 0 ? 'bg-yellow-100 border-yellow-400' : index === 1 ? 'bg-gray-200 border-gray-400' : index === 2 ? 'bg-orange-100 border-orange-400' : 'bg-white border-gray-300'}`}>
                                    <span className="font-medium text-lg">
                                        {index + 1}. {sp.name}
                                        {index === 0 && ' 🥇'}
                                        {index === 1 && ' 🥈'}
                                        {index === 2 && ' 🥉'}
                                    </span>
                                    <span className="font-bold text-xl">{sp.projectCount}</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-gray-600 text-center">No projects logged yet.</p>
                    )}
                </Card>
            </div>
            )}
        </div>
    );
};

// --- Display Page Components ---

// Individual Project Cell for the Display Grid
const ProjectGridCell = ({ project, locationMap }) => {
    const locationDetails = Object.values(locationMap).find(loc => loc.id === project.location);
    const tileBgColor = locationDetails ? locationDetails.tileColor : 'bg-gray-100/80 border-gray-400';

    return (
        <div className={`aspect-square shadow-lg rounded-lg flex flex-col items-center justify-center p-1.5 sm:p-2 text-center border ${tileBgColor} hover:shadow-xl transition-shadow`}>
            {/* Icon container (80% of cell) */}
            <div className="w-[80%] h-[80%] flex items-center justify-center">
                {isIconUrl(project.projectIcon) ? (
                    <img src={project.projectIcon} alt={project.projectName}
                         className="max-w-full max-h-full object-contain"
                         onError={(e) => { e.target.style.display='none'; }}/>
                ) : (
                    // Adjust text size to be large, it will be contained by the 80% div
                    <span className="text-5xl sm:text-6xl md:text-7xl lg:text-7xl" style={{lineHeight: 1}}>{project.projectIcon}</span>
                )}
            </div>
            {/* Text container */}
            <div className="w-full text-center mt-auto pt-0.5">
                <p className="text-sm sm:text-lg font-semibold text-gray-800 truncate px-1">{project.salespersonName}</p>
                {locationDetails && <p className="text-xs sm:text-base text-gray-700">{locationDetails.abbreviation}</p>}
            </div>
        </div>
    );
};

// Main Display Page
const DisplayPage = () => {
    const { loggedProjects, monthlyGoal, setCurrentPage, resetMonthlyData, isLoading, locations } = useContext(AppContext);
    const [currentTime, setCurrentTime] = useState(new Date());

    // Effect to update time every second
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer); // Cleanup timer on unmount
    }, []);

    const projectsToDisplay = loggedProjects.slice(0, monthlyGoal); 
    const emptyCellsCount = Math.max(0, monthlyGoal - projectsToDisplay.length);
    
    // Dynamically calculate number of columns for the grid
    // Aims for squarish cells, typically 5 columns for 30 items (6 rows)
    const numColumns = Math.min(5, Math.max(3, Math.ceil(Math.sqrt(monthlyGoal * 0.7))));

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white p-2 sm:p-4 md:p-6 flex flex-col items-center justify-center">
            <div className="w-full max-w-[2160px] h-full flex flex-col"> {/* Max width for large displays */}
                <header className="w-full mb-2 md:mb-4 text-center py-1 sm:py-2">
                    <div className="flex justify-between items-center mb-2 sm:mb-3 px-2">
                        <img src="TUDS Logo Colour.png" alt="TUDS Logo" 
                             className="h-16 sm:h-20 md:h-24 rounded" // Adjusted logo size
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
                        {loggedProjects.length} <span className="text-xl sm:text-2xl text-gray-300">of</span> {monthlyGoal} <span className="text-xl sm:text-2xl text-gray-300">Done!</span>
                    </p>
                    {loggedProjects.length >= monthlyGoal && (
                        <p className="mt-1 text-xl sm:text-2xl text-green-400 animate-pulse">🎉 Goal Achieved! 🎉</p>
                    )}
                </header>

                <main className="w-full flex-grow flex items-center justify-center px-1 sm:px-2">
                    {isLoading && <LoadingSpinner message="Loading Projects..." />}
                    {!isLoading && (
                        <div className={`grid gap-1.5 sm:gap-2 md:gap-3 w-full`} style={{gridTemplateColumns: `repeat(${numColumns}, minmax(0, 1fr))`}}>
                            {projectsToDisplay.map(proj => (
                                <ProjectGridCell key={proj.id} project={proj} locationMap={locations} />
                            ))}
                            {/* Render empty cells to fill up to the monthly goal */}
                            {Array.from({ length: emptyCellsCount }).map((_, idx) => (
                                <div key={`empty_${idx}`} className="aspect-square bg-slate-800/70 rounded-lg opacity-60"></div>
                            ))}
                        </div>
                    )}
                    {/* Message if no projects are logged */}
                    { !isLoading && loggedProjects.length === 0 && emptyCellsCount === monthlyGoal && (
                        <div className="text-center py-10">
                            <p className="text-2xl sm:text-3xl text-gray-400">No projects logged yet for this month.</p>
                        </div>
                    )}
                </main>
                
                <footer className="w-full mt-2 md:mt-4 text-center py-1 sm:py-2">
                    <Button onClick={() => setCurrentPage('input')} variant="secondary" className="mr-2 sm:mr-4 text-xs sm:text-sm" disabled={isLoading}>
                        Input Page
                    </Button>
                    <Button onClick={resetMonthlyData} variant="danger" className="text-xs sm:text-sm" disabled={isLoading}>
                        Admin: Reset Data
                    </Button>
                </footer>
            </div>
        </div>
    );
};

// --- Main Application Component ---
function App() {
    const { currentPage, setCurrentPage: contextSetCurrentPage } = useContext(AppContext);

    // Effect to handle URL hash changes for navigation
    useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash;
            if (contextSetCurrentPage) { // Ensure context function is available
                if (hash === '#/display') contextSetCurrentPage('display');
                else if (hash === '#/input' || hash === '') contextSetCurrentPage('input'); // Default to input
            }
        };
        window.addEventListener('hashchange', handleHashChange, false);
        handleHashChange(); // Call on initial load
        return () => window.removeEventListener('hashchange', handleHashChange, false);
    }, [contextSetCurrentPage]); // Rerun if context function changes

    return (
        <div className="min-h-screen bg-gray-100 font-sans">
            {currentPage === 'input' ? <InputPage /> : <DisplayPage />}
        </div>
    );
}

// Export the App wrapped with the Provider
export default function ProvidedApp() {
  return (
    <AppProvider>
      <App />
    </AppProvider>
  );
}
