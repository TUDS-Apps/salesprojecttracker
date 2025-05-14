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
    { id: 'railing', name: 'Railing', icon: 'https://placehold.co/64x64/transparent/333333?text=⛓️&font=roboto' },
    { id: 'deck', name: 'Deck', icon: 'https://placehold.co/64x64/transparent/333333?text=🪵&font=roboto' },
    { id: 'patio', name: 'Patio', icon: 'https://placehold.co/64x64/transparent/333333?text=🪨&font=roboto' },
    { id: 'fence', name: 'Fence', icon: 'https://placehold.co/64x64/transparent/333333?text=🧱&font=roboto' },
    { id: 'pergola', name: 'Pergola', icon: 'https://placehold.co/64x64/transparent/333333?text=🌿&font=roboto' },
    { id: 'turf', name: 'Turf', icon: 'https://placehold.co/64x64/transparent/333333?text=🌱&font=roboto' },
];

const MONTHLY_GOAL = 30;

const PROJECTS_COLLECTION = 'projects';
const LOCATIONS = {
    REGINA: { id: 'regina', name: 'Regina', abbreviation: 'RGNA', tileColor: 'bg-blue-100/80 border-blue-400', bucketColor: 'border-blue-400 bg-blue-50 hover:bg-blue-100', textColor: 'text-blue-700', bucketOverColor: 'border-blue-600 bg-blue-100 scale-105' },
    SASKATOON: { id: 'saskatoon', name: 'Saskatoon', abbreviation: 'SKTN', tileColor: 'bg-green-100/80 border-green-400', bucketColor: 'border-green-400 bg-green-50 hover:bg-green-100', textColor: 'text-green-700', bucketOverColor: 'border-green-600 bg-green-100 scale-105' }
};

const isIconUrl = (iconString) => typeof iconString === 'string' && (iconString.startsWith('http') || iconString.startsWith('/') || iconString.includes('.'));

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
            console.error("Error fetching projects: ", error);
            alert("Could not fetch project data.");
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
            alert("Error: Invalid salesperson, project type, or location selected.");
            return false; // Indicate failure
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
            return true; // Indicate success
        } catch (error) {
            console.error("Error adding project: ", error);
            alert("Error logging project.");
            return false; // Indicate failure
        }
    };
    
    const resetMonthlyDataInFirebase = async () => {
        if (window.confirm("RESET ALL PROJECT DATA? This cannot be undone.")) {
            setIsLoading(true);
            try {
                const projectsQuerySnapshot = await getDocs(collection(db, PROJECTS_COLLECTION));
                const deletePromises = projectsQuerySnapshot.docs.map(doc => deleteDoc(doc.ref));
                await Promise.all(deletePromises);
                alert("All project data has been reset.");
            } catch (error) {
                console.error("Error resetting data: ", error);
                alert("Error resetting data.");
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

// --- Confetti Effect ---
const createConfettiPiece = () => {
    const piece = document.createElement('div');
    piece.style.position = 'fixed';
    piece.style.left = `${Math.random() * 100}vw`;
    piece.style.top = `${Math.random() * -20 - 5}vh`; // Start above screen
    piece.style.width = `${Math.random() * 10 + 5}px`;
    piece.style.height = piece.style.width;
    piece.style.backgroundColor = `hsl(${Math.random() * 360}, 100%, 50%)`;
    piece.style.opacity = '0'; // Start invisible
    piece.style.zIndex = '9999';
    piece.style.borderRadius = '50%';
    document.body.appendChild(piece);
    return piece;
};

const animateConfettiPiece = (piece) => {
    const fallDuration = Math.random() * 2 + 1.5; // 1.5 to 3.5 seconds
    const swayAmount = Math.random() * 100 - 50; // -50 to 50 vw for horizontal sway

    piece.animate([
        { transform: `translate3d(0, 0, 0) rotate(${Math.random() * 360}deg)`, opacity: 1 },
        { transform: `translate3d(${swayAmount}px, 110vh, 0) rotate(${Math.random() * 720 + 360}deg)`, opacity: 0 }
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

const triggerConfetti = (count = 100) => {
    for (let i = 0; i < count; i++) {
        setTimeout(() => {
            const piece = createConfettiPiece();
            animateConfettiPiece(piece);
        }, i * 10); // Stagger creation
    }
};

// --- Input Page Components ---
const ProjectIcon = ({ project, onDragStart }) => (
    <div draggable onDragStart={(e) => onDragStart(e, project.id)}
        className="flex flex-col items-center justify-center p-2 m-1 border-2 border-dashed border-gray-300 rounded-lg cursor-grab hover:bg-gray-100 transition-colors aspect-square"
        title={project.name}> {/* Keep title for hover tooltip */}
        {isIconUrl(project.icon) ? (
            <img src={project.icon} alt={project.name} className="w-12 h-12 sm:w-16 sm:h-16 object-contain pointer-events-none" 
                 onError={(e) => { e.target.style.display='none'; }}/>
        ) : (
            <span className="text-4xl sm:text-5xl pointer-events-none">{project.icon}</span>
        )}
        {/* Removed project name text below icon */}
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

const InputPage = () => {
    const { addProject, salespersons, projectTypes, setCurrentPage, isLoading, locations, loggedProjects } = useContext(AppContext);
    const [selectedSalesperson, setSelectedSalesperson] = useState(''); 
    const [draggingOverBucket, setDraggingOverBucket] = useState(null);
    const [showSuccessMessage, setShowSuccessMessage] = useState({ show: false, location: '' });

    const handleDragStart = (e, projectId) => e.dataTransfer.setData('projectId', projectId);

    const handleDrop = async (e, locationId) => {
        e.preventDefault();
        setDraggingOverBucket(null);
        const projectId = e.dataTransfer.getData('projectId');
        if (selectedSalesperson && projectId && locationId) {
            const success = await addProject(selectedSalesperson, projectId, locationId);
            if (success) {
                setShowSuccessMessage({ show: true, location: locations[locationId.toUpperCase()].name });
                triggerConfetti(80); // Trigger confetti on success
                setTimeout(() => setShowSuccessMessage({ show: false, location: '' }), 3000);
            }
        } else if (!selectedSalesperson) {
            alert("Please select a salesperson first.");
        }
    };

    const handleDragOver = (e, locationId) => {
        e.preventDefault();
        setDraggingOverBucket(locationId);
    };
    
    const handleDragLeave = () => setDraggingOverBucket(null);

    const getProjectCountForLocation = (locationId) => loggedProjects.filter(p => p.location === locationId).length;

    const salespersonStats = SALESPERSONS.map(sp => ({
        ...sp,
        projectCount: loggedProjects.filter(p => p.salespersonId === sp.id).length
    })).sort((a, b) => b.projectCount - a.projectCount);

    return (
        <div className="container mx-auto p-4 md:p-6 max-w-5xl"> {/* Increased max-width for leaderboards */}
            <Card>
                <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
                    <h1 className="text-3xl md:text-4xl font-bold text-gray-800">Log New Project</h1>
                    <Button onClick={() => setCurrentPage('display')} variant="secondary" disabled={isLoading}>View Display Board</Button>
                </div>

                {isLoading && <LoadingSpinner message="Connecting..." />}
                {showSuccessMessage.show && (
                    <div className="mb-4 p-3 bg-sky-100 border border-sky-400 text-sky-700 rounded-lg text-center transition-opacity duration-300 ease-in-out opacity-100">
                        Project logged for {showSuccessMessage.location}! 🎉
                    </div>
                )}

                <div className="mb-6">
                    <label htmlFor="salesperson" className="block text-lg font-medium text-gray-700 mb-2">Salesperson:</label>
                    <select id="salesperson" value={selectedSalesperson} onChange={(e) => setSelectedSalesperson(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 text-lg" disabled={isLoading} required>
                        <option value="" disabled>Select Salesperson</option>
                        {salespersons.map(sp => <option key={sp.id} value={sp.id}>{sp.name}</option>)}
                    </select>
                </div>

                <div className="mb-6">
                    <h2 className="text-xl font-semibold text-gray-700 mb-3">Available Projects:</h2>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2"> {/* Adjusted grid for 6 items */}
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
                    <div className="space-y-3">
                        <div className={`p-4 rounded-lg shadow ${locations.REGINA.bucketColor} ${locations.REGINA.textColor}`}>
                            <h3 className="text-lg font-medium">{locations.REGINA.name} Projects:</h3>
                            <p className="text-3xl font-bold">{getProjectCountForLocation(locations.REGINA.id)}</p>
                        </div>
                        <div className={`p-4 rounded-lg shadow ${locations.SASKATOON.bucketColor} ${locations.SASKATOON.textColor}`}>
                            <h3 className="text-lg font-medium">{locations.SASKATOON.name} Projects:</h3>
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
const ProjectGridCell = ({ project, locationMap }) => {
    const locationDetails = Object.values(locationMap).find(loc => loc.id === project.location);
    const tileBgColor = locationDetails ? locationDetails.tileColor : 'bg-gray-100/80 border-gray-400';

    return (
        <div className={`aspect-square shadow-lg rounded-lg flex flex-col items-center justify-around p-1.5 sm:p-2 text-center border ${tileBgColor} hover:shadow-xl transition-shadow`}>
            {isIconUrl(project.projectIcon) ? (
                <img src={project.projectIcon} alt={project.projectName} 
                     className="w-24 h-24 sm:w-32 sm:h-32 md:w-40 md:h-40 lg:w-48 lg:h-48 object-contain my-1" // Significantly increased icon size
                     onError={(e) => { e.target.style.display='none'; }}/>
            ) : (
                <span className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl my-1">{project.projectIcon}</span> // Significantly increased emoji size
            )}
            <div className="mt-auto text-center w-full">
                <p className="text-xs sm:text-sm font-semibold text-gray-800 truncate px-1">{project.salespersonName}</p>
                {locationDetails && <p className="text-[10px] sm:text-xs text-gray-700">{locationDetails.abbreviation}</p>}
            </div>
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
    
    const numColumns = Math.min(5, Math.max(3, Math.ceil(Math.sqrt(monthlyGoal * 0.7)))); // Adjusted for potentially larger cells due to larger icons

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white p-2 sm:p-4 md:p-6 flex flex-col items-center justify-center">
            <div className="w-full max-w-[2160px] h-full flex flex-col"> {/* Adjusted max-width for typical 4K width in portrait */}
                <header className="w-full mb-2 md:mb-4 text-center py-1 sm:py-2">
                     <div className="flex justify-between items-center mb-2 sm:mb-3 px-2">
                        <img src="https://placehold.co/250x80/ffffff/333333?text=YourLogo&font=roboto" alt="Company Logo" 
                             className="h-16 sm:h-20 md:h-24 rounded" // Increased logo size by ~50%
                             onError={(e) => e.target.src='https://placehold.co/250x80/CCCCCC/FFFFFF?text=Logo_Err'}/>
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
                        Project Achievements
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
                            {Array.from({ length: emptyCellsCount }).map((_, idx) => (
                                <div key={`empty_${idx}`} className="aspect-square bg-slate-800/70 rounded-lg opacity-60"></div>
                            ))}
                        </div>
                    )}
                    { !isLoading && loggedProjects.length === 0 && emptyCellsCount === monthlyGoal && (
                        <div className="text-center py-10">
                            <p className="text-2xl sm:text-3xl text-gray-400">No projects logged yet.</p>
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
