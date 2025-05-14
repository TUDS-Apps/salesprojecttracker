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
    // If using local images in the 'public' folder, the path would be like '/icons/railing.png'
    { id: 'railing', name: 'Railing', icon: 'https://placehold.co/64x64/transparent/333333?text=⛓️&font=roboto' }, // Example URL
    { id: 'deck', name: 'Deck', icon: 'https://placehold.co/64x64/transparent/333333?text=🪵&font=roboto' },       // Example URL
    { id: 'patio', name: 'Patio', icon: 'https://placehold.co/64x64/transparent/333333?text=🪨&font=roboto' },       // Example URL
    { id: 'fence', name: 'Fence', icon: 'https://placehold.co/64x64/transparent/333333?text=🧱&font=roboto' },       // Example URL
    { id: 'pergola', name: 'Pergola', icon: 'https://placehold.co/64x64/transparent/333333?text=🌿&font=roboto' },   // Example URL
    { id: 'turf', name: 'Turf', icon: 'https://placehold.co/64x64/transparent/333333?text=🌱&font=roboto' },         // Example URL
];

// --- Monthly Goal - Manually change this value when the target changes ---
const MONTHLY_GOAL = 30; // Example: change to 40 if the target is 40
// ---

const PROJECTS_COLLECTION = 'projects';
const LOCATIONS = {
    REGINA: { id: 'regina', name: 'Regina', tileColor: 'bg-blue-100/80 border-blue-400', bucketColor: 'border-blue-400 bg-blue-50 hover:bg-blue-100', textColor: 'text-blue-700', bucketOverColor: 'border-blue-600 bg-blue-100 scale-105' },
    SASKATOON: { id: 'saskatoon', name: 'Saskatoon', tileColor: 'bg-green-100/80 border-green-400', bucketColor: 'border-green-400 bg-green-50 hover:bg-green-100', textColor: 'text-green-700', bucketOverColor: 'border-green-600 bg-green-100 scale-105' }
};

// Helper function to check if an icon string is a URL or path
const isIconUrl = (iconString) => {
    // Check if the string starts with http, https, or a slash (for relative paths)
    // Also check if it contains a period, which is common in file extensions for images.
    // This is a basic check and might need refinement for more complex scenarios.
    return typeof iconString === 'string' && (iconString.startsWith('http') || iconString.startsWith('/') || iconString.includes('.'));
};

// --- Context for Shared State ---
const AppContext = createContext();

const AppProvider = ({ children }) => {
    const [loggedProjects, setLoggedProjects] = useState([]);
    const [currentPage, setCurrentPage] = useState('input');
    const [isLoading, setIsLoading] = useState(true);

    // Effect to determine initial page based on URL hash or localStorage
    useEffect(() => {
        const getInitialPage = () => {
            const hash = window.location.hash;
            if (hash === '#/display') return 'display';
            if (hash === '#/input') return 'input';
            // Fallback to localStorage if no specific hash
            const storedPage = localStorage.getItem('salesTrackerCurrentPage');
            return storedPage === 'display' ? 'display' : 'input'; // Default to 'input'
        };
        setCurrentPage(getInitialPage());
    }, []); // Runs once on initial mount

    // Effect to fetch and listen for real-time project updates from Firestore
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
        // Cleanup listener on component unmount
        return () => unsubscribe();
    }, []); // Runs once on initial mount

    // Function to handle setting the current page and updating localStorage/URL hash
    const handleSetCurrentPage = (page) => {
        setCurrentPage(page);
        localStorage.setItem('salesTrackerCurrentPage', page);
        window.location.hash = page === 'display' ? '#/display' : '#/input';
    };

    // Function to add a new project to Firebase
    const addProjectToFirebase = async (salespersonId, projectTypeId, locationId) => {
        const salesperson = SALESPERSONS.find(s => s.id === salespersonId);
        const projectType = PROJECT_TYPES.find(p => p.id === projectTypeId);
        const location = LOCATIONS[locationId.toUpperCase()]; // Ensure locationId matches keys in LOCATIONS

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
                projectIcon: projectType.icon, // This will now store the URL or emoji
                projectName: projectType.name,
                location: location.id, // Save location id (e.g., 'regina', 'saskatoon')
                timestamp: serverTimestamp(), // Use server timestamp for consistency
            });
            // Real-time listener (onSnapshot) will update loggedProjects state automatically
        } catch (error) {
            console.error("Error adding project to Firestore: ", error);
            alert("Error logging project. Please try again.");
        }
    };
    
    // Function to reset all monthly data from Firebase
    const resetMonthlyDataInFirebase = async () => {
        if (window.confirm("Are you sure you want to RESET ALL project data for the month from the database? This cannot be undone.")) {
            setIsLoading(true);
            try {
                const projectsQuerySnapshot = await getDocs(collection(db, PROJECTS_COLLECTION));
                // For deleting multiple documents, batch writes are more efficient if available/preferred,
                // but iterating and deleting is fine for this scale.
                const deletePromises = projectsQuerySnapshot.docs.map(doc => deleteDoc(doc.ref));
                await Promise.all(deletePromises);
                alert("All project data has been reset from the database.");
                // onSnapshot will automatically update the local state to an empty array
            } catch (error) {
                console.error("Error resetting data in Firestore: ", error);
                alert("Error resetting data. Please try again.");
            } finally {
                setIsLoading(false);
            }
        }
    };

    // Provide state and functions to child components through context
    return (
        <AppContext.Provider value={{ 
            loggedProjects, 
            addProject: addProjectToFirebase, 
            currentPage, 
            setCurrentPage: handleSetCurrentPage, 
            monthlyGoal: MONTHLY_GOAL, 
            salespersons: SALESPERSONS, 
            projectTypes: PROJECT_TYPES, 
            resetMonthlyData: resetMonthlyDataInFirebase, 
            isLoading, 
            locations: LOCATIONS // Provide locations context for buckets and tiles
        }}>
            {children}
        </AppContext.Provider>
    );
};

// --- Reusable UI Components ---
const Card = ({ children, className = '' }) => (
    <div className={`bg-white shadow-xl rounded-lg p-6 md:p-8 ${className}`}>
        {children}
    </div>
);

const Button = ({ children, onClick, className = '', variant = 'primary', disabled = false }) => {
    const baseStyle = 'px-6 py-3 rounded-lg font-semibold shadow-md focus:outline-none focus:ring-2 focus:ring-opacity-75 transition-all duration-150 ease-in-out';
    const styles = {
        primary: 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500',
        secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-800 focus:ring-gray-400',
        danger: 'bg-red-500 hover:bg-red-600 text-white focus:ring-red-400',
    };
    return (
        <button 
            onClick={onClick} 
            disabled={disabled}
            className={`${baseStyle} ${styles[variant]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}>
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
    // Component for displaying a draggable project icon (either image or emoji)
    <div 
        draggable 
        onDragStart={(e) => onDragStart(e, project.id)}
        className="flex flex-col items-center justify-center p-3 m-1.5 border-2 border-dashed border-gray-300 rounded-lg cursor-grab hover:bg-gray-100 transition-colors aspect-square"
        title={`Drag to add ${project.name}`}>
        {isIconUrl(project.icon) ? (
            // If icon is a URL, render an img tag
            <img 
                src={project.icon} 
                alt={project.name} 
                className="w-10 h-10 sm:w-12 sm:h-12 object-contain pointer-events-none" // Prevent image itself from being dragged
                // Basic error handling for broken image links
                onError={(e) => { 
                    e.target.style.display='none'; // Hide the broken image
                    // Optionally, show a fallback text or emoji if the next sibling is designed for it
                    const fallback = e.target.nextElementSibling;
                    if (fallback && fallback.classList.contains('fallback-icon-text')) {
                        fallback.style.display='block';
                    }
                }}
            />
            // Fallback text (initially hidden, shown on image error if onError is configured to do so)
            // <span className="fallback-icon-text text-3xl sm:text-4xl pointer-events-none hidden">❓</span>
        ) : (
            // If icon is not a URL (e.g., an emoji), render it as text
            <span className="text-3xl sm:text-4xl pointer-events-none">{project.icon}</span>
        )}
        <span className="mt-1 text-xs text-center text-gray-700 pointer-events-none">{project.name}</span>
    </div>
);

const LocationBucket = ({ locationDetails, onDrop, onDragOver, onDragLeave, isOver, projectCount }) => (
    // Component for the drag-and-drop target bucket for a specific location
    <div 
        onDrop={(e) => onDrop(e, locationDetails.id)} 
        onDragOver={onDragOver} 
        onDragLeave={onDragLeave}
        className={`mt-6 p-6 md:p-8 border-4 border-dashed rounded-xl text-center transition-all duration-200 ease-in-out min-h-[150px] flex flex-col justify-center items-center
                    ${isOver ? locationDetails.bucketOverColor : locationDetails.bucketColor}`}>
        <h3 className={`text-xl font-semibold mb-2 ${locationDetails.textColor}`}>{locationDetails.name} Projects</h3>
        {/* Bucket icon */}
        <svg className={`w-12 h-12 mb-2 ${isOver ? locationDetails.textColor : locationDetails.textColor } opacity-70`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
        <p className={`text-md font-medium ${locationDetails.textColor}`}>
            {isOver ? "Release to log!" : "Drag Project Here"}
        </p>
        <p className={`text-sm ${locationDetails.textColor} opacity-80`}>{projectCount} logged for {locationDetails.name}</p>
    </div>
);

const InputPage = () => {
    // Component for the project input page
    const { addProject, salespersons, projectTypes, setCurrentPage, isLoading, locations, loggedProjects } = useContext(AppContext);
    const [selectedSalesperson, setSelectedSalesperson] = useState(salespersons[0]?.id || '');
    const [draggingOverBucket, setDraggingOverBucket] = useState(null); // Tracks which bucket is being dragged over
    const [showSuccessMessage, setShowSuccessMessage] = useState({ show: false, location: '' }); // For success feedback

    // Handler for when a project icon drag starts
    const handleDragStart = (e, projectId) => {
        e.dataTransfer.setData('projectId', projectId); // Set data to be transferred
    };

    // Handler for when a project icon is dropped onto a bucket
    const handleDrop = async (e, locationId) => {
        e.preventDefault(); // Prevent default drop behavior
        setDraggingOverBucket(null); // Reset dragging over state
        const projectId = e.dataTransfer.getData('projectId'); // Get project ID from transferred data
        if (selectedSalesperson && projectId && locationId) {
            await addProject(selectedSalesperson, projectId, locationId); // Add project to Firebase
            // Show success message
            setShowSuccessMessage({ show: true, location: locations[locationId.toUpperCase()].name });
            setTimeout(() => setShowSuccessMessage({ show: false, location: '' }), 2500); // Hide after 2.5s
        }
    };

    // Handler for when a dragged item is over a bucket
    const handleDragOver = (e, locationId) => {
        e.preventDefault(); // Allow dropping
        setDraggingOverBucket(locationId); // Set which bucket is being hovered over
    };
    
    // Handler for when a dragged item leaves a bucket area
    const handleDragLeave = () => {
        setDraggingOverBucket(null); // Reset dragging over state
    };

    // Helper to count projects for a specific location
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

                {/* Salesperson Selection Dropdown */}
                <div classNam
