import React, { useState, useEffect, createContext, useContext } from 'react';
import { db } from './firebase'; // Make sure firebase.js is in the src folder
import { collection, addDoc, onSnapshot, query, orderBy, where, serverTimestamp, deleteDoc, doc, getDoc, getDocs, writeBatch, setDoc, updateDoc } from "firebase/firestore"; 
// Lucide-react import is removed as the pencil icon is an emoji.
// If other lucide icons are needed elsewhere, the dependency and imports should be managed accordingly.

// Tailwind CSS is assumed to be available globally.

// --- Configuration ---
const SALESPERSONS = [
    { id: 'dale', name: 'Dale', initials: 'DA' },
    { id: 'justin', name: 'Justin', initials: 'JU' },
    { id: 'meghan', name: 'Meghan', initials: 'ME' },
    { id: 'rickielee', name: 'Rickie-Lee', initials: 'RL' },
    { id: 'roberta', name: 'Roberta', initials: 'RO' },
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
const STREAKS_COLLECTION = 'streaks';
const ACHIEVEMENTS_COLLECTION = 'achievements';
const PERSONAL_BESTS_COLLECTION = 'personalBests';

const TEAM_ACHIEVEMENTS = [
    { id: 'first100', name: 'Century Club', description: 'First week with 100+ projects', icon: '💯', requirement: (stats) => stats.weeklyProjects >= 100 },
    { id: 'perfectWeek', name: 'Perfect Week', description: 'Hit exactly the weekly goal', icon: '🎯', requirement: (stats) => stats.weeklyProjects === stats.weeklyGoal },
    { id: 'mondayMotivator', name: 'Monday Motivator', description: '20+ projects on a Monday', icon: '💪', requirement: (stats) => stats.mondayProjects >= 20 },
    { id: 'speedDemon', name: 'Speed Demon', description: '10 projects in 1 hour', icon: '⚡', requirement: (stats) => stats.hourlyMax >= 10 },
    { id: 'allHands', name: 'All Hands on Deck', description: 'Every salesperson contributed in one day', icon: '🤝', requirement: (stats) => stats.allSalespeopleDay },
    { id: 'doubleGoal', name: 'Double Trouble', description: 'Achieved 2x the weekly goal', icon: '2️⃣', requirement: (stats) => stats.weeklyProjects >= stats.weeklyGoal * 2 },
    { id: 'streakMaster', name: 'Streak Master', description: 'Maintained a 7-day streak', icon: '🔥', requirement: (stats) => stats.currentStreak >= 7 },
    { id: 'varietyPack', name: 'Variety Pack', description: 'All project types in one day', icon: '🎨', requirement: (stats) => stats.allProjectTypesDay },
]; 

const LOCATIONS = { 
    REGINA: { id: 'regina', name: 'Regina', abbreviation: 'RGNA', tileColor: 'bg-blue-100/80 border-blue-400', bucketColor: 'border-blue-400 bg-blue-50 hover:bg-blue-100', textColor: 'text-blue-700', bucketOverColor: 'border-blue-600 bg-blue-100 scale-105' },
    SASKATOON: { id: 'saskatoon', name: 'Saskatoon', abbreviation: 'SKTN', tileColor: 'bg-green-100/80 border-green-400', bucketColor: 'border-green-400 bg-green-50 hover:bg-green-100', textColor: 'text-green-700', bucketOverColor: 'border-green-600 bg-green-100 scale-105' }
};

const isIconUrl = (iconString) => typeof iconString === 'string' && (iconString.startsWith('http') || iconString.startsWith('/') || iconString.includes('.'));

const formatDate = (date, options = { month: 'short', day: 'numeric' }) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString(undefined, options);
};

// --- Context for Application State ---
const AppContext = createContext();

const AppProvider = ({ children }) => {
    const [loggedProjects, setLoggedProjects] = useState([]);
    const [weeklyRecords, setWeeklyRecords] = useState([]); 
    const [currentWeeklyGoal, setCurrentWeeklyGoal] = useState(DEFAULT_WEEKLY_GOAL); 
    const [currentPage, setCurrentPage] = useState('input');
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessingWeek, setIsProcessingWeek] = useState(false); 
    const [isUpdatingTarget, setIsUpdatingTarget] = useState(false);
    const [isUpdatingRecord, setIsUpdatingRecord] = useState(false);
    const [streakData, setStreakData] = useState({});
    const [achievements, setAchievements] = useState([]);
    const [personalBests, setPersonalBests] = useState({});
    const [monthlyChampion, setMonthlyChampion] = useState(null);
    const [lastMilestone, setLastMilestone] = useState(0);
    const [liveUpdates, setLiveUpdates] = useState([]); 

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
    
    // Load streak data
    useEffect(() => {
        const streakRef = doc(db, STREAKS_COLLECTION, 'teamStreak');
        const unsubscribeStreak = onSnapshot(streakRef, (docSnap) => {
            if (docSnap.exists()) {
                setStreakData(docSnap.data());
            }
        });
        
        // Load personal bests
        const unsubscribeBests = onSnapshot(collection(db, PERSONAL_BESTS_COLLECTION), (snapshot) => {
            const bests = {};
            snapshot.docs.forEach(doc => {
                bests[doc.id] = doc.data();
            });
            setPersonalBests(bests);
        });
        
        // Load monthly champion
        const championRef = doc(db, APP_SETTINGS_COLLECTION, 'monthlyChampion');
        const unsubscribeChampion = onSnapshot(championRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                const currentMonth = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                // Only show champion for current month
                if (data.month === currentMonth) {
                    setMonthlyChampion(data);
                } else {
                    setMonthlyChampion(null);
                }
            }
        });
        
        // Load achievements
        const unsubscribeAchievements = onSnapshot(collection(db, ACHIEVEMENTS_COLLECTION), (snapshot) => {
            const achievementsList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setAchievements(achievementsList);
        });
        
        return () => {
            unsubscribeStreak();
            unsubscribeBests();
            unsubscribeChampion();
            unsubscribeAchievements();
        };
    }, []);

    useEffect(() => {
        setIsLoading(true); 
        const projectsQuery = query(collection(db, PROJECTS_COLLECTION), orderBy('timestamp', 'desc'));
        const recordsQuery = query(collection(db, WEEKLY_RECORDS_COLLECTION), orderBy('weekEndDate', 'desc')); 
        let projectsLoaded = false;
        let recordsLoaded = false;
        const checkAllLoaded = () => { if (projectsLoaded && recordsLoaded) setIsLoading(false); };

        let previousProjectIds = new Set();
        
        const unsubscribeProjects = onSnapshot(projectsQuery, (querySnapshot) => {
            const projectsData = querySnapshot.docs
                .map(pDoc => ({ ...pDoc.data(), id: pDoc.id }))
                .filter(project => !project.archived); // Filter out archived projects
            
            // Detect new projects for live updates
            const currentProjectIds = new Set(projectsData.map(p => p.id));
            if (previousProjectIds.size > 0) {
                projectsData.forEach(project => {
                    if (!previousProjectIds.has(project.id)) {
                        // New project detected
                        const update = {
                            id: Date.now() + Math.random(),
                            message: `${project.salespersonName} just added a ${project.projectName}!`,
                            time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                        };
                        setLiveUpdates(prev => [...prev, update]);
                        // Remove notification after 5 seconds
                        setTimeout(() => {
                            setLiveUpdates(prev => prev.filter(u => u.id !== update.id));
                        }, 5000);
                    }
                });
            }
            previousProjectIds = currentProjectIds;
            
            setLoggedProjects(projectsData);
            // Re-enabled with safety: Automatic Sunday reset with archiving instead of deletion
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

    const handleSetCurrentPage = (page) => { 
        setCurrentPage(page);
        localStorage.setItem('salesTrackerCurrentPage', page);
        window.location.hash = page === 'display' ? '#/display' : '#/input';
    };
    
    const updatePersonalBest = async (salespersonId, salespersonName) => {
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Start of week (Sunday)
        weekStart.setHours(0, 0, 0, 0);
        
        const weekProjectCount = loggedProjects.filter(p => 
            p.salespersonId === salespersonId && 
            p.timestamp && new Date(p.timestamp.seconds * 1000) >= weekStart
        ).length + 1; // +1 for the project just added
        
        const bestRef = doc(db, PERSONAL_BESTS_COLLECTION, salespersonId);
        const bestDoc = await getDoc(bestRef);
        
        if (bestDoc.exists()) {
            const currentBest = bestDoc.data().weeklyBest || 0;
            if (weekProjectCount > currentBest) {
                await updateDoc(bestRef, {
                    weeklyBest: weekProjectCount,
                    achievedDate: new Date().toISOString(),
                    salespersonName
                });
                // Trigger special celebration for personal best
                setTimeout(() => {
                    showPersonalBestNotification(salespersonName, weekProjectCount);
                }, 1000);
            }
        } else {
            await setDoc(bestRef, {
                weeklyBest: weekProjectCount,
                achievedDate: new Date().toISOString(),
                salespersonName
            });
        }
    };
    
    const showPersonalBestNotification = (name, count) => {
        playSound('achievement');
        const popup = document.createElement('div');
        popup.className = 'personal-best-popup';
        popup.innerHTML = `
            <div class="personal-best-content">
                <h2>🏆 NEW PERSONAL BEST! 🏆</h2>
                <p>${name} just set a new weekly record!</p>
                <p class="count">${count} projects this week!</p>
            </div>
        `;
        
        const style = document.createElement('style');
        style.textContent = `
            .personal-best-popup {
                position: fixed;
                top: 20%;
                left: 50%;
                transform: translateX(-50%);
                z-index: 10003;
                animation: best-appear 0.5s ease-out;
            }
            .personal-best-content {
                background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
                padding: 2rem 3rem;
                border-radius: 1rem;
                box-shadow: 0 10px 40px rgba(0,0,0,0.3);
                text-align: center;
                color: white;
            }
            .personal-best-content h2 {
                font-size: 2.5rem;
                font-weight: bold;
                margin-bottom: 0.5rem;
            }
            .personal-best-content .count {
                font-size: 2rem;
                font-weight: bold;
                margin-top: 0.5rem;
            }
            @keyframes best-appear {
                from { transform: translateX(-50%) translateY(-50px) scale(0.8); opacity: 0; }
                to { transform: translateX(-50%) translateY(0) scale(1); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(popup);
        
        triggerConfetti(200);
        
        setTimeout(() => {
            popup.remove();
            style.remove();
        }, 4000);
    };
    const addProjectToFirebase = async (salespersonId, projectTypeId, locationId) => { 
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
            
            // Update streak data
            const today = new Date().toDateString();
            const streakRef = doc(db, STREAKS_COLLECTION, 'teamStreak');
            const streakDoc = await getDoc(streakRef);
            
            if (streakDoc.exists()) {
                const data = streakDoc.data();
                const lastDate = data.lastDate;
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                
                if (lastDate === today) {
                    // Already logged today, no change
                } else if (lastDate === yesterday.toDateString()) {
                    // Continuing streak
                    await updateDoc(streakRef, {
                        currentStreak: data.currentStreak + 1,
                        lastDate: today,
                        bestStreak: Math.max(data.currentStreak + 1, data.bestStreak || 0)
                    });
                } else {
                    // Streak broken, start new
                    await updateDoc(streakRef, {
                        currentStreak: 1,
                        lastDate: today
                    });
                }
            } else {
                // First time
                await setDoc(streakRef, {
                    currentStreak: 1,
                    lastDate: today,
                    bestStreak: 1
                });
            }
            
            // Update personal best for salesperson
            await updatePersonalBest(salespersonId, salesperson.name);
            
            return true;
        } catch (error) {
            console.error("Error adding project: ", error);
            alert("Error logging project. Please check console for details.");
            return false;
        }
    };
    const updateWeeklyTargetInDB = async (newTarget) => { 
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
    const deleteAllProjectsFromBoard = async () => { 
        const projectsQuerySnapshot = await getDocs(collection(db, PROJECTS_COLLECTION));
        if (projectsQuerySnapshot.empty) return;
        
        // Instead of deleting, mark projects as archived
        const batch = writeBatch(db);
        const archiveTimestamp = new Date().toISOString();
        
        projectsQuerySnapshot.docs.forEach(pDoc => {
            // Move to archive by updating with archived flag
            batch.update(doc(db, PROJECTS_COLLECTION, pDoc.id), {
                archived: true,
                archivedAt: archiveTimestamp,
                visible: false
            });
        });
        
        try {
            await batch.commit();
            console.log(`Archived ${projectsQuerySnapshot.size} projects instead of deleting`);
        } catch (error) {
            console.error("Failed to archive projects:", error);
            throw error;
        }
    };
    
    const logWeekAndResetBoard = async (isAuto = false, projectsForLog = loggedProjects) => { 
        if (!isAuto && !window.confirm("This will log the current week's project count, save it, and then clear the display board. Are you sure?")) {
            return;
        }
        setIsProcessingWeek(true);
        try {
            const today = new Date(); 
            
            // Corrected logic for Sunday-Saturday week that just ended
            const endOfLoggedWeek = new Date(today);
            // today.getDay() is 0 for Sunday, 1 for Mon, ..., 6 for Sat.
            // To get the Saturday of the week that just ended (or today if today is Saturday):
            // Subtract (today.getDay() + 1) % 7 days.
            // If today is Sunday (0), (0+1)%7 = 1. Subtract 1 day -> previous Saturday.
            // If today is Monday (1), (1+1)%7 = 2. Subtract 2 days -> previous Saturday.
            // ...
            // If today is Saturday (6), (6+1)%7 = 0. Subtract 0 days -> today (Saturday).
            endOfLoggedWeek.setDate(today.getDate() - ((today.getDay() + 1) % 7) ); 
            endOfLoggedWeek.setHours(23, 59, 59, 999); // End of Saturday

            const startOfLoggedWeek = new Date(endOfLoggedWeek);
            startOfLoggedWeek.setDate(endOfLoggedWeek.getDate() - 6); // Go back 6 days to get Sunday
            startOfLoggedWeek.setHours(0, 0, 0, 0); // Start of Sunday

            const weekDisplay = `${formatDate(startOfLoggedWeek)} - ${formatDate(endOfLoggedWeek)}`;
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
                weekEndDate: endOfLoggedWeek.toISOString(), 
                topSalespersonName, 
                topSalespersonProjects, 
                loggedAt: serverTimestamp()
            };

            // First, try to save the weekly record
            const recordRef = await addDoc(collection(db, WEEKLY_RECORDS_COLLECTION), newRecord);
            
            // Check if it's the end of month and crown a monthly champion
            const currentDate = new Date();
            const tomorrow = new Date(currentDate);
            tomorrow.setDate(currentDate.getDate() + 1);
            
            if (currentDate.getMonth() !== tomorrow.getMonth()) {
                // End of month - determine monthly champion
                const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
                const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
                
                // Get all projects for this month
                const monthProjectsQuery = await getDocs(
                    query(collection(db, PROJECTS_COLLECTION), 
                    where('timestamp', '>=', monthStart),
                    where('timestamp', '<=', monthEnd))
                );
                
                const monthlyStats = {};
                monthProjectsQuery.docs.forEach(doc => {
                    const project = doc.data();
                    monthlyStats[project.salespersonId] = (monthlyStats[project.salespersonId] || 0) + 1;
                });
                
                // Find the champion
                let championId = null;
                let maxProjects = 0;
                for (const [salespersonId, count] of Object.entries(monthlyStats)) {
                    if (count > maxProjects) {
                        maxProjects = count;
                        championId = salespersonId;
                    }
                }
                
                if (championId) {
                    const champion = SALESPERSONS.find(s => s.id === championId);
                    const championRef = doc(db, APP_SETTINGS_COLLECTION, 'monthlyChampion');
                    await setDoc(championRef, {
                        salespersonId: championId,
                        salespersonName: champion?.name || 'Unknown',
                        projectCount: maxProjects,
                        month: currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
                        crownedAt: serverTimestamp()
                    });
                }
            }
            
            // Only delete projects if the weekly record was successfully saved
            if (recordRef.id) {
                // Backup projects before deletion
                const backupCollection = collection(db, 'projectsBackup');
                const backupBatch = writeBatch(db);
                
                for (const project of projectsForLog) {
                    const backupDoc = doc(backupCollection);
                    backupBatch.set(backupDoc, {
                        ...project,
                        backedUpAt: serverTimestamp(),
                        weekArchived: weekDisplay,
                        originalId: project.id
                    });
                }
                
                try {
                    await backupBatch.commit();
                    console.log(`Backed up ${projectsForLog.length} projects before deletion`);
                } catch (backupError) {
                    console.error("Failed to backup projects:", backupError);
                    // Continue with deletion anyway, as weekly record is already saved
                }
                
                await deleteAllProjectsFromBoard();
                
                if (!isAuto) alert("Current projects logged for the week and display board has been reset.");
                else console.log("Weekly projects automatically logged and board reset for week ending: " + endOfLoggedWeek.toLocaleDateString());
            } else {
                throw new Error("Failed to save weekly record - projects NOT deleted for safety");
            }

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

    const handleAutoSundayReset = async (currentProjects) => { 
        const today = new Date();
        if (today.getDay() === 0) { 
            const todayISO = today.toISOString().split('T')[0]; 
            const lastAutoResetSunday = localStorage.getItem('lastAutoResetSunday');

            if (lastAutoResetSunday !== todayISO) {
                console.log("Attempting automatic Sunday log and reset...");
                await logWeekAndResetBoard(true, currentProjects); 
                localStorage.setItem('lastAutoResetSunday', todayISO);
            }
        }
    };
    
    const exportDataToJSON = () => {
        const data = {
            projects: loggedProjects,
            weeklyRecords: weeklyRecords,
            weeklyGoal: currentWeeklyGoal,
            exportDate: new Date().toISOString(),
            exportVersion: "1.0"
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `project-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <AppContext.Provider value={{ 
            loggedProjects, weeklyRecords, addProject: addProjectToFirebase, currentPage, 
            setCurrentPage: handleSetCurrentPage, weeklyGoal: currentWeeklyGoal, 
            updateWeeklyTarget: updateWeeklyTargetInDB, 
            salespersons: SALESPERSONS, projectTypes: PROJECT_TYPES, 
            logWeekAndResetBoard, updateWeeklyRecord: updateWeeklyRecordInDB, 
            isLoading, isProcessingWeek, isUpdatingTarget, isUpdatingRecord, 
            locationsData: LOCATIONS, exportDataToJSON,
            lastMilestone, setLastMilestone, streakData, achievements,
            personalBests, monthlyChampion, liveUpdates, setLiveUpdates
        }}>
            {children}
        </AppContext.Provider>
    );
};

// Live Update Notification Component
const LiveUpdateNotification = ({ updates }) => {
    const [visibleUpdates, setVisibleUpdates] = useState([]);
    
    useEffect(() => {
        setVisibleUpdates(updates.slice(-3)); // Show last 3 updates
    }, [updates]);
    
    if (visibleUpdates.length === 0) return null;
    
    return (
        <div className="fixed bottom-4 right-4 space-y-2 z-[9999]">
            {visibleUpdates.map((update, index) => (
                <div
                    key={update.id}
                    className="bg-white shadow-lg rounded-lg p-4 border-2 border-blue-400 animate-slide-in-right"
                    style={{
                        animation: `slide-in-right 0.3s ease-out`,
                        animationDelay: `${index * 0.1}s`
                    }}
                >
                    <p className="font-semibold text-blue-700">{update.message}</p>
                    <p className="text-sm text-gray-600">{update.time}</p>
                </div>
            ))}
            <style jsx>{`
                @keyframes slide-in-right {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
            `}</style>
        </div>
    );
};

// Streak Display Component
const StreakDisplay = ({ streakData }) => {
    if (!streakData || !streakData.currentStreak) return null;
    
    return (
        <div className="fixed top-4 right-4 bg-white shadow-lg rounded-lg p-4 border-2 border-orange-400 z-[9998]">
            <div className="flex items-center gap-2">
                <span className="text-3xl">🔥</span>
                <div>
                    <p className="font-bold text-lg text-orange-600">{streakData.currentStreak} Day Streak!</p>
                    <p className="text-sm text-gray-600">Best: {streakData.bestStreak || streakData.currentStreak} days</p>
                </div>
            </div>
        </div>
    );
};

// Achievements Display Component
const AchievementsDisplay = ({ achievements, expandable = true }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const unlockedAchievements = TEAM_ACHIEVEMENTS.filter(ach => 
        achievements.some(a => a.id === ach.id)
    );
    
    if (unlockedAchievements.length === 0) return null;
    
    return (
        <div className={`bg-white shadow-lg rounded-lg border-2 border-purple-400 ${expandable ? 'fixed bottom-4 left-4 z-[9998]' : ''}`}>
            <div 
                className={`p-4 ${expandable ? 'cursor-pointer' : ''}`}
                onClick={() => expandable && setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-2xl">🏆</span>
                        <p className="font-bold text-lg text-purple-600">
                            {unlockedAchievements.length} Achievement{unlockedAchievements.length !== 1 ? 's' : ''}
                        </p>
                    </div>
                    {expandable && (
                        <span className="text-gray-400">{isExpanded ? '▼' : '▶'}</span>
                    )}
                </div>
            </div>
            {(isExpanded || !expandable) && (
                <div className="border-t border-purple-200 p-4 space-y-2 max-h-64 overflow-y-auto">
                    {unlockedAchievements.map(ach => {
                        const achievedData = achievements.find(a => a.id === ach.id);
                        return (
                            <div key={ach.id} className="flex items-start gap-3 p-2 bg-purple-50 rounded">
                                <span className="text-2xl">{ach.icon}</span>
                                <div className="flex-1">
                                    <p className="font-semibold text-purple-700">{ach.name}</p>
                                    <p className="text-sm text-gray-600">{ach.description}</p>
                                    {achievedData && (
                                        <p className="text-xs text-gray-500 mt-1">
                                            Achieved: {new Date(achievedData.achievedDate).toLocaleDateString()}
                                        </p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// --- UI Components ---
const Card = ({ children, className = '' }) => ( 
    <div className={`bg-white shadow-xl rounded-lg p-6 md:p-8 ${className}`}>
        {children}
    </div>
);
const Button = ({ children, onClick, className = '', variant = 'primary', disabled = false }) => ( 
    <button onClick={onClick} disabled={disabled}
        className={`px-6 py-3 rounded-lg font-semibold shadow-md focus:outline-none focus:ring-2 focus:ring-opacity-75 transition-all ${
            variant === 'primary' ? 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500' :
            variant === 'secondary' ? 'bg-gray-200 hover:bg-gray-300 text-gray-800 focus:ring-gray-400' :
            'bg-red-500 hover:bg-red-600 text-white focus:ring-red-400' 
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}>
        {children}
    </button>
);
const LoadingSpinner = ({ message = "Loading..."}) => ( 
    <div className="flex flex-col items-center justify-center p-10 text-gray-700">
        <svg className="animate-spin h-10 w-10 text-blue-600 mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle>
          <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75"></path>
        </svg>
        <p className="text-lg">{message}</p>
    </div>
);
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

// Sound effects system
const playSound = (type) => {
    const audio = new Audio();
    switch(type) {
        case 'drop':
            // Simple click sound using Web Audio API
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.1);
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.1);
            break;
        case 'milestone':
            // Ascending chime for milestones
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            [523, 659, 784].forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.1);
                gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.1);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.1 + 0.3);
                osc.start(ctx.currentTime + i * 0.1);
                osc.stop(ctx.currentTime + i * 0.1 + 0.3);
            });
            break;
        case 'achievement':
            // Victory fanfare
            const actx = new (window.AudioContext || window.webkitAudioContext)();
            [523, 659, 784, 1047].forEach((freq, i) => {
                const osc = actx.createOscillator();
                const gain = actx.createGain();
                osc.connect(gain);
                gain.connect(actx.destination);
                osc.frequency.setValueAtTime(freq, actx.currentTime + i * 0.15);
                gain.gain.setValueAtTime(0.4, actx.currentTime + i * 0.15);
                gain.gain.exponentialRampToValueAtTime(0.01, actx.currentTime + i * 0.15 + 0.5);
                osc.start(actx.currentTime + i * 0.15);
                osc.stop(actx.currentTime + i * 0.15 + 0.5);
            });
            break;
    }
};

// Enhanced celebration for different milestone levels
const triggerMilestoneCelebration = (percentage, projectCount, weeklyGoal) => {
    let celebrationLevel = 'small';
    let message = '';
    let confettiCount = 150;
    
    if (percentage >= 100) {
        celebrationLevel = 'epic';
        message = '🎉 GOAL ACHIEVED! AMAZING WORK TEAM! 🎉';
        confettiCount = 300;
        playSound('achievement');
    } else if (percentage >= 75) {
        celebrationLevel = 'large';
        message = '🔥 75% THERE! FINAL PUSH! 🔥';
        confettiCount = 200;
        playSound('milestone');
    } else if (percentage >= 50) {
        celebrationLevel = 'medium';
        message = '⭐ HALFWAY POINT! KEEP GOING! ⭐';
        confettiCount = 150;
        playSound('milestone');
    } else if (percentage >= 25) {
        celebrationLevel = 'small';
        message = '✨ 25% COMPLETE! GREAT START! ✨';
        confettiCount = 100;
        playSound('milestone');
    }
    
    if (message) {
        // Create milestone popup
        const popup = document.createElement('div');
        popup.className = 'milestone-popup';
        popup.innerHTML = `
            <div class="milestone-content ${celebrationLevel}">
                <h2>${message}</h2>
                <p>${projectCount} of ${weeklyGoal} projects completed!</p>
            </div>
        `;
        
        // Add CSS dynamically
        const style = document.createElement('style');
        style.textContent = `
            .milestone-popup {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                z-index: 10002;
                animation: milestone-appear 0.5s ease-out;
            }
            .milestone-content {
                background: white;
                padding: 2rem 3rem;
                border-radius: 1rem;
                box-shadow: 0 10px 40px rgba(0,0,0,0.3);
                text-align: center;
            }
            .milestone-content h2 {
                font-size: 2rem;
                font-weight: bold;
                margin-bottom: 0.5rem;
                color: #1e40af;
            }
            .milestone-content.epic h2 {
                font-size: 3rem;
                background: linear-gradient(45deg, #f59e0b, #ef4444, #8b5cf6);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                animation: pulse 1s ease-in-out infinite;
            }
            @keyframes milestone-appear {
                from { transform: translate(-50%, -50%) scale(0); opacity: 0; }
                to { transform: translate(-50%, -50%) scale(1); opacity: 1; }
            }
            @keyframes pulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.05); }
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(popup);
        
        triggerConfetti(confettiCount);
        
        setTimeout(() => {
            popup.remove();
            style.remove();
        }, 3000);
    }
};
const ProjectIcon = ({ project, onDragStart }) => ( 
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

const WeeklyLogDisplay = () => {
    const { weeklyRecords, isLoading, logWeekAndResetBoard, isProcessingWeek, weeklyGoal, updateWeeklyTarget, isUpdatingTarget, updateWeeklyRecord, isUpdatingRecord, exportDataToJSON } = useContext(AppContext); 
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
            target: record.target.toString() 
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

    const handleDeleteRecord = async (recordId, weekDisplay) => {
        if (window.confirm(`Are you sure you want to permanently delete the record for ${weekDisplay}? This cannot be undone.`)) {
            try {
                const recordRef = doc(db, WEEKLY_RECORDS_COLLECTION, recordId);
                await deleteDoc(recordRef);
                alert("Weekly record deleted successfully!");
                setEditingRecordId(null);
            } catch (error) {
                console.error("Error deleting weekly record: ", error);
                console.error("Error details:", error.message, error.code);
                alert(`Failed to delete weekly record. Error: ${error.message}`);
            }
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
                                        <Button onClick={() => handleDeleteRecord(record.id, record.weekDisplay)} variant="danger" className="py-1 px-3 text-xs ml-auto">Delete</Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="font-medium text-md">{record.weekDisplay}</span>
                                            <span className={`font-bold text-lg ml-2 ${record.completed >= record.target ? 'text-green-600' : 'text-red-600'}`}>
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
                                    </div>
                                    {/* Using a Unicode pencil emoji as the edit button */}
                                    <button 
                                        onClick={() => handleEditClick(record)} 
                                        className="p-1 text-gray-500 hover:text-blue-600 disabled:opacity-50 text-lg" // text-lg for emoji size
                                        disabled={isUpdatingRecord || isProcessingWeek}
                                        title="Edit Log Entry"
                                    >
                                        ✏️
                                    </button>
                                </div>
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
                {/* Finalize Week Button - Made smaller and less prominent */}
                <button 
                    type="button" 
                    onClick={() => logWeekAndResetBoard(false)} 
                    className="w-full text-xs text-orange-600 hover:text-orange-800 disabled:opacity-50 py-2 rounded-md border border-orange-300 hover:bg-orange-50 transition-colors" 
                    disabled={isLoading || isProcessingWeek || isUpdatingRecord}
                >
                    {isProcessingWeek ? 'Processing...' : 'Admin: Manual Week Log & Reset'}
                </button>
                {/* Export Data Button */}
                <button 
                    type="button" 
                    onClick={exportDataToJSON} 
                    className="w-full text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50 py-2 rounded-md border border-blue-300 hover:bg-blue-50 transition-colors mt-2" 
                    disabled={isLoading}
                >
                    Export Data Backup (JSON)
                </button>
            </form>
        </Card>
    );
};

const InputPage = () => { 
    const { 
        addProject, salespersons, projectTypes, setCurrentPage, isLoading, 
        isProcessingWeek, locationsData: locations, loggedProjects, weeklyGoal,
        lastMilestone, setLastMilestone, liveUpdates, streakData, personalBests, 
        achievements, monthlyChampion
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
                playSound('drop');
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
                
                // Check for milestones
                const newProjectCount = loggedProjects.length + 1;
                const percentage = (newProjectCount / weeklyGoal) * 100;
                const milestones = [25, 50, 75, 100];
                
                for (const milestone of milestones) {
                    if (percentage >= milestone && lastMilestone < milestone) {
                        setTimeout(() => {
                            triggerMilestoneCelebration(milestone, newProjectCount, weeklyGoal);
                            setLastMilestone(milestone);
                        }, 3500); // Wait for regular celebration to finish
                        break;
                    }
                }
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
            <LiveUpdateNotification updates={liveUpdates} />
            <StreakDisplay streakData={streakData} />
            <AchievementsDisplay achievements={achievements} /> 
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
                                {salespersonStats.map((sp, index) => {
                                    const personalBest = personalBests[sp.id]?.weeklyBest || 0;
                                    const isNewRecord = personalBest > 0 && sp.projectCount >= personalBest;
                                    return (
                                        <li key={sp.id} className={`p-3 rounded-lg shadow flex justify-between items-center text-gray-700 ${index === 0 ? 'bg-yellow-100 border-yellow-400' : index === 1 ? 'bg-gray-200 border-gray-400' : index === 2 ? 'bg-orange-100 border-orange-400' : 'bg-white border-gray-300'} ${monthlyChampion?.salespersonId === sp.id ? 'ring-2 ring-purple-500' : ''}`}>
                                            <div>
                                                <span className="font-medium text-lg">
                                                    {index + 1}. {sp.name} 
                                                    {index === 0 && '🥇'} 
                                                    {index === 1 && '🥈'} 
                                                    {index === 2 && '🥉'}
                                                    {monthlyChampion?.salespersonId === sp.id && ' 👑'}
                                                </span>
                                                {personalBest > 0 && (
                                                    <p className="text-xs text-gray-600">
                                                        Personal Best: {personalBest} {isNewRecord && '🎯'}
                                                    </p>
                                                )}
                                                {monthlyChampion?.salespersonId === sp.id && (
                                                    <p className="text-xs text-purple-600 font-semibold">
                                                        Monthly Champion!
                                                    </p>
                                                )}
                                            </div>
                                            <span className="font-bold text-xl">{sp.projectCount}</span>
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : ( <p className="text-gray-600 text-center py-4">No projects logged yet.</p> )}
                    </Card>
                </div>
                <div> 
                    <Card className="bg-gray-50 h-full"> 
                        <h2 className="text-2xl font-semibold text-gray-700 mb-4 text-center">Project Types This Week</h2>
                        {(() => {
                            const projectTypeCounts = PROJECT_TYPES.map(pt => ({
                                ...pt,
                                count: loggedProjects.filter(p => p.projectTypeId === pt.id).length
                            })).sort((a, b) => b.count - a.count).filter(pt => pt.count > 0);
                            
                            return projectTypeCounts.length > 0 ? (
                                <ul className="space-y-2">
                                    {projectTypeCounts.map((pt, index) => (
                                        <li key={pt.id} className="p-3 rounded-lg shadow bg-white flex justify-between items-center">
                                            <div className="flex items-center gap-2">
                                                {isIconUrl(pt.icon) ? (
                                                    <img src={pt.icon} alt={pt.name} className="w-8 h-8 object-contain" />
                                                ) : (
                                                    <span className="text-2xl">{pt.icon}</span>
                                                )}
                                                <span className="font-medium text-lg">{pt.name}</span>
                                                {index === 0 && <span title="Most Popular!">🏆</span>}
                                            </div>
                                            <span className="font-bold text-xl">{pt.count}</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : <p className="text-gray-600 text-center py-4">No projects logged yet.</p>;
                        })()}
                    </Card>
                </div>
            </div>
        </div>
    );
};

const ProjectGridCell = ({ project, locationMap }) => { 
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
const DisplayPage = () => { 
    const { 
        loggedProjects, weeklyGoal, setCurrentPage, isLoading, 
        isProcessingWeek, locationsData: locations, liveUpdates 
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
            <LiveUpdateNotification updates={liveUpdates} />
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
function App() { 
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
export default function ProvidedApp() { 
  return (
    <AppProvider>
      <App />
    </AppProvider>
  );
}
