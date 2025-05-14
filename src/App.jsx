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
].sort((a, b) => a.name.localeCompare(b.name)); // Sorted alphabetically

const PROJECT_TYPES = [
    // Replace these example icon URLs with your actual icon URLs or emojis
    // If using local images in the 'public' folder, the path would be like 'railing.png'
    { id: 'railing', name: 'Railing', icon: 'railing.png' },
    { id: 'deck', name: 'Deck', icon: 'deck.png' },
    { id: 'hardscapes', name: 'Hardscapes', icon: 'hardscapes.png' },
    { id: 'fence', name: 'Fence', icon: 'fence.png' },
    { id: 'pergola', name: 'Pergola', icon: 'pergola.png' },
    { id: 'turf', name: 'Turf', icon: 'turf.png' },
];

// --- Monthly Goal - Manually change this value when the target changes ---
const MONTHLY_GOAL = 60; // Example: change to 40 if the target is 40
// ---

const PROJECTS_COLLECTION = 'projects';
const LOCATIONS = {
    REGINA: { id: 'regina', name: 'Regina', tileColor: 'bg-blue-100/80 border-blue-400', bucketColor: 'border-blue-400 bg-blue-50 hover:bg-blue-100', textColor: 'text-blue-700', bucketOverColor: 'border-blue-600 bg-blue-100 scale-105' },
    SASKATOON: { id: 'saskatoon', name: 'Saskatoon', tileColor: 'bg-green-100/80 border-green-400', bucketColor: 'border-green-400 bg-green-50 hover:bg-green-100', textColor: 'text-green-700', bucketOverColor: 'border-green-600 bg-green-100 scale-105' }
};

// Helper function to check if an icon string is a URL or path
const isIconUrl = (iconString) => {
    return typeof iconString === 'string' && (iconString.startsWith('http') || iconString.startsWith('/') || iconString.includes('.'));
};

// --- Context for Shared State ---
const AppContext = createContext();

const AppProvider = ({ children }) => {
    const [loggedProjects, setLoggedProjects] = useState([]);
    const [currentPage, setCurrentPage] = useState('input');
    const [isLoading, setIsLoading] = useState(true);

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
        setIsLoading(true);
        const q = query(collection(db, PROJECTS_COLLECTION), orderBy('timestamp', 'desc'));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const projectsData = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
            setLoggedProjects(projectsData);
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching projects from Firestore: ", error);
            alert("Could not fetch project data. Please check your internet connection or Firebase setup.");
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleSetCurrentPage = (page) => {
        setCurrentPage(page);
        localStorage.setItem('salesTrackerCurrentPage', page);
        window.location.hash = page === 'display' ? '#/display' : '#/input';
    };

    const addProjectToFirebase = async (salespersonId, projectTypeId, locationId) => {
        const salesperson = SALESPERSONS.find(s => s.id === salespersonId);
        const projectType = PROJECT_TYPES.find(p => p.id === projectTypeId);
        const location = LOCATIONS[locationId.toUpperCase()];

        if (!salesperson || !projectType || !location) {
            console.error("Invalid salesperson, project type, or location:", {salespersonId, projectTypeId, locationId});
            alert("Error: Invalid salesperson, project type, or location selected.");
            return;
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
        } catch (error) {
            console.error("Error adding project to Firestore: ", error);
            alert("Error logging project. Please try again.");
        }
    };
    
    const resetMonthlyDataInFirebase = async () => {
        if (window.confirm("Are you sure you want to RESET ALL project data for the month from the database? This cannot be undone.")) {
            setIsLoading(true);
            try {
                const projectsQuerySnapshot = await getDocs(collection(db, PROJECTS_COLLECTION));
                const deletePromises = projectsQuerySnapshot.docs.map(doc => deleteDoc(doc.ref));
                await Promise.all(deletePromises);
                alert("All project data has been reset from the database.");
            } catch (error) {
                console.error("Error resetting data in Firestore: ", error);
                alert("Error resetting data. Please try again.");
            } finally {
                setIsLoading(false);
            }
        }
    };

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

// --- Reusable UI Components ---
const Card = ({ children, className = '' }) => <div className={`bg-white shadow-xl rounded-lg p-6 md:p-8 ${className}`}>{children}</div>;

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

// --- Input Page Components ---
const ProjectIcon = ({ project, onDragStart }) => (
    <div draggable onDragStart={(e) => onDragStart(e, project.id)}
        className="flex flex-col items-center justify-center p-3 m-1.5 border-2 border-dashed border-gray-300 rounded-lg cursor-grab hover:bg-gray-100 transition-colors aspect-square"
        title={`Drag to add ${project.name}`}>
        {isIconUrl(project.icon) ? (
            <img 
                src={project.icon} 
                alt={project.name} 
                className="w-10 h-10 sm:w-12 sm:h-12 object-contain pointer-events-none" 
                onError={(e) => { e.target.style.display='none'; const fallback = e.target.nextElementSibling; if (fallback && fallback.classList.contains('fallback-icon-text')) { fallback.style.display='block';}}}
            />
        ) : (
            <span className="text-3xl sm:text-4xl pointer-events-none">{project.icon}</span>
        )}
        <span className="mt-1 text-xs text-center text-gray-700 pointer-events-none">{project.name}</span>
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
        <p className={`text-sm ${locationDetails.textColor} opacity-80`}>{projectCount} logged for {locationDetails.name}</p>
    </div>
);

const InputPage = () => {
    const { addProject, salespersons, projectTypes, setCurrentPage, isLoading, locations, loggedProjects } = useContext(AppContext);
    // MODIFIED: Default selectedSalesperson to an empty string
    const [selectedSalesperson, setSelectedSalesperson] = useState(''); 
    const [draggingOverBucket, setDraggingOverBucket] = useState(null);
    const [showSuccessMessage, setShowSuccessMessage] = useState({ show: false, location: '' });

    const handleDragStart = (e, projectId) => e.dataTransfer.setData('projectId', projectId);

    const handleDrop = async (e, locationId) => {
        e.preventDefault();
        setDraggingOverBucket(null);
        const projectId = e.dataTransfer.getData('projectId');
        if (selectedSalesperson && projectId && locationId) { // Check if salesperson is selected
            await addProject(selectedSalesperson, projectId, locationId);
            setShowSuccessMessage({ show: true, location: locations[locationId.toUpperCase()].name });
            setTimeout(() => setShowSuccessMessage({ show: false, location: '' }), 2500);
        } else if (!selectedSalesperson) {
            alert("Please select a salesperson first."); // Alert if no salesperson is selected
        }
    };

    const handleDragOver = (e, locationId) => {
        e.preventDefault();
        setDraggingOverBucket(locationId);
    };
    
    const handleDragLeave = () => setDraggingOverBucket(null);

    const getProjectCountForLocation = (locationId) => {
        return loggedProjects.filter(p => p.location === locationId).length;
    };

    return (
        <div className="container mx-auto p-4 md:p-6 max-w-4xl">
            <Card>
                <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
                    <h1 className="text-3xl md:text-4xl font-bold text-gray-800">Log New Project</h1>
                    <Button onClick={() => setCurrentPage('display')} variant="secondary" disabled={isLoading}>View Display Board</Button>
                </div>

                {isLoading && <LoadingSpinner message="Connecting..." />}
                {showSuccessMessage.show && (
                    <div className="mb-4 p-3 bg-sky-100 border border-sky-400 text-sky-700 rounded-lg text-center">
                        Project logged for {showSuccessMessage.location}! 🎉
                    </div>
                )}

                <div className="mb-6">
                    <label htmlFor="salesperson" className="block text-lg font-medium text-gray-700 mb-2">Salesperson:</label>
                    {/* MODIFIED: Added default "Select Salesperson" option */}
                    <select 
                        id="salesperson" 
                        value={selectedSalesperson} 
                        onChange={(e) => setSelectedSalesperson(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 text-lg" 
                        disabled={isLoading}
                        required // Makes it a required field in terms of form validation, though JS handles logic
                    >
                        <option value="" disabled>
                            Select Salesperson
                        </option>
                        {salespersons.map(sp => <option key={sp.id} value={sp.id}>{sp.name}</option>)}
                    </select>
                </div>

                <div className="mb-6">
                    <h2 className="text-xl font-semibold text-gray-700 mb-3">Available Projects:</h2>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-2">
                        {projectTypes.map(pt => <ProjectIcon key={pt.id} project={pt} onDragStart={handleDragStart} />)}
                    </div>
                </div>
                
                <div className="grid md:grid-cols-2 gap-4 md:gap-6">
                    <LocationBucket 
                        locationDetails={locations.REGINA} 
                        onDrop={handleDrop} onDragOver={(e) => handleDragOver(e, locations.REGINA.id)} onDragLeave={handleDragLeave}
                        isOver={draggingOverBucket === locations.REGINA.id}
                        projectCount={getProjectCountForLocation(locations.REGINA.id)}
                    />
                    <LocationBucket 
                        locationDetails={locations.SASKATOON} 
                        onDrop={handleDrop} onDragOver={(e) => handleDragOver(e, locations.SASKATOON.id)} onDragLeave={handleDragLeave}
                        isOver={draggingOverBucket === locations.SASKATOON.id}
                        projectCount={getProjectCountForLocation(locations.SASKATOON.id)}
                    />
                </div>
            </Card>
        </div>
    );
};

// --- Display Page Components ---
const ProjectGridCell = ({ project, locationMap }) => {
    const locationDetails = Object.values(locationMap).find(loc => loc.id === project.location);
    const tileBgColor = locationDetails ? locationDetails.tileColor : 'bg-gray-100/80 border-gray-400';

    return (
        <div className={`aspect-square shadow-lg rounded-lg flex flex-col items-center justify-center p-1.5 sm:p-2 text-center border ${tileBgColor} hover:shadow-xl transition-shadow`}>
            {isIconUrl(project.projectIcon) ? (
                <img 
                    src={project.projectIcon} 
                    alt={project.projectName} 
                    className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 lg:w-32 lg:h-32 object-contain"
                    onError={(e) => { e.target.style.display='none'; const fallback = e.target.nextElementSibling; if (fallback && fallback.classList.contains('fallback-icon-text')) { fallback.style.display='block';}}}
                />
            ) : (
                <span className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl">{project.projectIcon}</span>
            )}
            <span className="mt-1 text-[10px] sm:text-xs font-semibold text-gray-800">{project.salespersonInitials}</span>
            {locationDetails && <span className="text-[9px] sm:text-[10px] text-gray-600">{locationDetails.name.substring(0,3).toUpperCase()}</span>}
        </div>
    );
};

const DisplayPage = () => {
    const { loggedProjects, monthlyGoal, setCurrentPage, resetMonthlyData, isLoading, locations } = useContext(AppContext);
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const projectsToDisplay = loggedProjects.slice(0, monthlyGoal); 
    const emptyCellsCount = Math.max(0, monthlyGoal - projectsToDisplay.length);
    
    const numColumns = Math.min(6, Math.max(3, Math.ceil(Math.sqrt(monthlyGoal * 0.8))));

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white p-4 sm:p-6 md:p-8 flex flex-col items-center justify-center">
            <div className="w-full max-w-[2100px] h-full flex flex-col">
                <header className="w-full mb-4 md:mb-6 text-center py-2">
                     <div className="flex justify-between items-center mb-3 sm:mb-4">
                        <img src="TUDS Logo Colour.png" alt="The Ultimate Deck Shop" className="h-12 sm:h-16 rounded" onError={(e) => e.target.src='https://placehold.co/200x70/CCCCCC/FFFFFF?text=Logo_Err'}/>
                        <div className="text-right">
                            <p className="text-lg sm:text-xl md:text-2xl font-medium text-gray-300">{currentTime.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                            <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-100">{currentTime.toLocaleTimeString()}</p>
                        </div>
                    </div>
                    <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-teal-400 to-green-400 leading-tight">
                        Customer Projects This Week!
                    </h1>
                    <p className="mt-2 text-3xl sm:text-4xl md:text-5xl font-bold text-yellow-400">
                        {loggedProjects.length} <span className="text-2xl sm:text-3xl text-gray-300">of</span> {monthlyGoal} <span className="text-2xl sm:text-3xl text-gray-300">Done!</span>
                    </p>
                     {loggedProjects.length >= monthlyGoal && (
                        <p className="mt-1 text-2xl sm:text-3xl text-green-400 animate-pulse">🎉 Goal Achieved! 🎉</p>
                    )}
                </header>

                <main className="w-full flex-grow flex items-center justify-center">
                    {isLoading && <LoadingSpinner message="Loading Projects..." />}
                    {!isLoading && (
                        <div className={`grid gap-2 sm:gap-3 md:gap-4 w-full`} style={{gridTemplateColumns: `repeat(${numColumns}, minmax(0, 1fr))`}}>
                            {projectsToDisplay.map(proj => (
                                <ProjectGridCell key={proj.id} project={proj} locationMap={locations} />
                            ))}
                            {Array.from({ length: emptyCellsCount }).map((_, idx) => (
                                <div key={`empty_${idx}`} className="aspect-square bg-slate-800/70 rounded-lg opacity-60"></div>
                            ))}
                        </div>
                    )}
                    { !isLoading && loggedProjects.length === 0 && emptyCellsCount === monthlyGoal && (
                        <div className="text-center py-10">
                            <p className="text-3xl text-gray-400">No projects logged yet.</p>
                        </div>
                    )}
                </main>
                
                <footer className="w-full mt-4 md:mt-8 text-center py-2">
                    <Button onClick={() => setCurrentPage('input')} variant="secondary" className="mr-4 text-sm sm:text-base" disabled={isLoading}>
                        Input Page
                    </Button>
                     <Button onClick={resetMonthlyData} variant="danger" className="text-sm sm:text-base" disabled={isLoading}>
                        Admin: Reset Data
                    </Button>
                </footer>
            </div>
        </div>
    );
};

// --- Main App Component ---
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
