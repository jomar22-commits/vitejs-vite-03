import { useState, useEffect } from "react";

import { db, auth } from "./firebase";

import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  addDoc,
  setDoc,
  deleteDoc,
  getDoc
} from "firebase/firestore";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "firebase/auth";

type Task = {
  id: string;
  title: string;
  description: string;
  points: number;
  completed: boolean;
  parentId?: string | null;
  createdByRole?: string;
  createdBy?: string;
  assignedTo?: string;
  evidenceUrl?: string;
  order?: number;
};

type Habit = {
  id: string;
  title: string;
  subtitle?: string;
  heading?: string;
  body?: string;
  frequency: string;
  points: number;
  streak: number;
  lastCompletedDate?: string | null;
  createdBy?: string;
  assignedTo?: string;
  order?: number;
  paused?: boolean;
};

type Reward = {
  id: string;
  title: string;
  description: string;
  cost: number;
  claimed: boolean;
  approved?: boolean;
  rejected?: boolean;
};

type Agreement = {
  id: string;
  title: string;
  category: "Acuerdo" | "Límite Duro" | "Límite Blando";
  description: string;
  status: "Aceptado" | "En Revisión";
};

type ContractSignature = {
  signedBy: string;
  signedAt: string;
  role: string;
};

type ActivityLog = {
  id: string;
  action: string;
  timestamp: string;
  type: "info" | "reward" | "penalty" | "pause";
};

type DiaryEntry = {
  id: string;
  authorId?: string;
  title: string;
  subtitle?: string;
  heading?: string;
  body?: string;
  authorName: string;
  authorRole: UserRole;
  content: string; // compatibilidad con entradas antiguas
  timestamp: string;
};

type ChatMessage = {
  id: string;
  senderUid: string;
  senderName: string;
  senderRole: UserRole;
  text: string;
  timestamp: string;
};

type UserRole = "Sub" | "Dominante";

type DynamicMember = {
  uid: string;
  displayName: string;
  role: UserRole;
  email?: string;
  joinedAt?: string;
};

type UserProfile = {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  photoUrl?: string;
  bio?: string;
  limitsNote?: string;
};

type Toast = {
  id: number;
  text: string;
  type: "success" | "warning" | "error" | "info";
};

const DYNAMIC_ID = "abc123xyz";

type AppTab =
  | "dashboard"
  | "tasks"
  | "habits"
  | "rewards"
  | "agreements"
  | "contract"
  | "activity"
  | "diary"
  | "chat"
  | "profile";

type AppSection =
  | "today"
  | "tasks"
  | "progress"
  | "communication"
  | "dynamic"
  | "personal";

type AppSectionConfig = {
  id: AppSection;
  label: string;
  description: string;
  defaultTab: AppTab;
  tabs: AppTab[];
};

const APP_SECTIONS: AppSectionConfig[] = [
  {
    id: "today",
    label: "Hoy",
    description: "Resumen y prioridades del día",
    defaultTab: "dashboard",
    tabs: ["dashboard"],
  },
  {
    id: "tasks",
    label: "Tareas",
    description: "Tareas, subtareas y puntos",
    defaultTab: "tasks",
    tabs: ["tasks"],
  },
  {
    id: "progress",
    label: "Progreso",
    description: "Hábitos, recompensas y evolución",
    defaultTab: "habits",
    tabs: ["habits", "rewards", "activity"],
  },
  {
    id: "communication",
    label: "Comunicación",
    description: "Conversación y memoria compartida",
    defaultTab: "chat",
    tabs: ["chat", "diary"],
  },
  {
    id: "dynamic",
    label: "Dinámica",
    description: "Acuerdos, límites y estructura compartida",
    defaultTab: "agreements",
    tabs: ["agreements", "contract"],
  },
  {
    id: "personal",
    label: "Mi espacio",
    description: "Perfil y configuración personal",
    defaultTab: "profile",
    tabs: ["profile"],
  },
];

const TAB_LABELS: Record<AppTab, string> = {
  dashboard: "Resumen",
  tasks: "Tareas",
  habits: "Hábitos",
  rewards: "Recompensas",
  agreements: "Acuerdos y límites",
  contract: "Contrato digital",
  activity: "Registro de actividad",
  diary: "Diario compartido",
  chat: "Chat directo",
  profile: "Perfil ampliado",
};

function App() {
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Sistema de Notificaciones Toast
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (text: string, type: "success" | "warning" | "error" | "info" = "info") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  // Modo Oscuro / Claro automático según la hora del equipo
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const hour = new Date().getHours();
    return hour < 6 || hour >= 19;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.remove("light-theme");
    } else {
      document.body.classList.add("light-theme");
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode((prev) => !prev);
  };

  // Normalización tipográfica global para evitar que el texto de los botones se comprima o deforme.
  useEffect(() => {
    const styleId = "dynamic-button-typography-fix";
    const existingStyle = document.getElementById(styleId);
    if (existingStyle) existingStyle.remove();

    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      .secondary-button {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif !important;
        font-size: 13px !important;
        font-weight: 600 !important;
        font-stretch: normal !important;
        letter-spacing: normal !important;
        line-height: 1.2 !important;
        white-space: nowrap !important;
        writing-mode: horizontal-tb !important;
        text-orientation: mixed !important;
        text-rendering: optimizeLegibility;
        box-sizing: border-box;
        flex-shrink: 0;
        transform: none !important;
      }
      .secondary-button:not([style*="width: 42px"]) {
        min-width: max-content;
      }
    `;
    document.head.appendChild(style);

    return () => {
      style.remove();
    };
  }, []);

  // Formulario Auth
  const [isRegistering, setIsRegistering] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [roleInput, setRoleInput] = useState<UserRole>("Sub");
  const [authError, setAuthError] = useState("");

  // Estados de la App
  const [activeTab, setActiveTab] = useState<AppTab>("dashboard");
  const [openNavSection, setOpenNavSection] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [members, setMembers] = useState<DynamicMember[]>([]);
  const [isPartnerCardOpen, setIsPartnerCardOpen] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [draggedHabitId, setDraggedHabitId] = useState<string | null>(null);
  const [openActionMenu, setOpenActionMenu] = useState<string | null>(null);
  const [isManagingHabits, setIsManagingHabits] = useState(false);
  const [habitSort, setHabitSort] = useState<"custom" | "az" | "points">("custom");
  const [showPausedHabits, setShowPausedHabits] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});
  const [expandedHabits, setExpandedHabits] = useState<Record<string, boolean>>({});
  const [expandedDiaryEntries, setExpandedDiaryEntries] = useState<Record<string, boolean>>({});
  const [habits, setHabits] = useState<Habit[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [signatures, setSignatures] = useState<ContractSignature[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newChatText, setNewChatText] = useState("");

  const [isPaused, setIsPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isObedienteActive, setIsObedienteActive] = useState(false);

  // Estados para Edición de Perfil Ampliado
  const [editBio, setEditBio] = useState("");
  const [editPhotoUrl, setEditPhotoUrl] = useState("");
  const [editLimits, setEditLimits] = useState("");

  const todayStr = new Date().toISOString().split("T")[0];
  const currentRole = userProfile?.role || "Sub";
  const activeUserName = userProfile?.displayName || userProfile?.email || "Usuario";

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userDocRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userDocRef);
        if (userSnap.exists()) {
          const pData = userSnap.data() as UserProfile;
          setUserProfile(pData);
          setEditBio(pData.bio || "");
          setEditPhotoUrl(pData.photoUrl || "");
          setEditLimits(pData.limitsNote || "");

          await setDoc(
            doc(db, "dynamics", DYNAMIC_ID, "members", currentUser.uid),
            {
              uid: currentUser.uid,
              displayName: pData.displayName || pData.email || "Usuario",
              role: pData.role || "Sub",
              email: pData.email || currentUser.email || "",
              joinedAt: new Date().toISOString()
            },
            { merge: true }
          );
        }
      } else {
        setUserProfile(null);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Cargar Firestore
  useEffect(() => {
    if (!user) return;

    const configRef = doc(db, "dynamics", DYNAMIC_ID);
    const membersRef = collection(db, "dynamics", DYNAMIC_ID, "members");
    const tasksRef = collection(db, "dynamics", DYNAMIC_ID, "tasks");
    const habitsRef = collection(db, "dynamics", DYNAMIC_ID, "habits");
    const rewardsRef = collection(db, "dynamics", DYNAMIC_ID, "rewards");
    const agreementsRef = collection(db, "dynamics", DYNAMIC_ID, "agreements");
    const logsRef = collection(db, "dynamics", DYNAMIC_ID, "activityLogs");
    const diaryRef = collection(db, "dynamics", DYNAMIC_ID, "diaryEntries");
    const chatRef = collection(db, "dynamics", DYNAMIC_ID, "chatMessages");

    const unsubConfig = onSnapshot(configRef, (snapshot: any) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setIsPaused(Boolean(data.isPaused));
        setSignatures(data.signatures || []);
      } else {
        setDoc(configRef, { isPaused: false, signatures: [] }, { merge: true });
      }
    });

    const unsubMembers = onSnapshot(membersRef, (snapshot: any) => {
      const fetchedMembers: DynamicMember[] = snapshot.docs.map((memberDoc: any) => ({
        uid: memberDoc.id,
        displayName: memberDoc.data().displayName || memberDoc.data().email || "Usuario",
        role: memberDoc.data().role || "Sub",
        email: memberDoc.data().email || "",
        joinedAt: memberDoc.data().joinedAt || ""
      }));
      setMembers(fetchedMembers);
    });

    const unsubTasks = onSnapshot(tasksRef, (snapshot: any) => {
      const fetchedTasks: Task[] = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        title: doc.data().title || "",
        description: doc.data().description || "",
        points: Number(doc.data().points) || 0,
        completed: Boolean(doc.data().completed),
        parentId: doc.data().parentId || null,
        createdByRole: doc.data().createdByRole || "Sub",
        createdBy: doc.data().createdBy || "",
        assignedTo: doc.data().assignedTo || "",
        evidenceUrl: doc.data().evidenceUrl || "",
        order: Number.isFinite(Number(doc.data().order)) ? Number(doc.data().order) : undefined
      }));
      setTasks(fetchedTasks);
      setLoading(false);
    });

    const unsubHabits = onSnapshot(habitsRef, (snapshot: any) => {
      const fetchedHabits: Habit[] = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        title: doc.data().title || "",
        subtitle: doc.data().subtitle || "",
        heading: doc.data().heading || "",
        body: doc.data().body || "",
        frequency: doc.data().frequency || "Diaria",
        points: Number(doc.data().points) || 10,
        streak: Number(doc.data().streak) || 0,
        lastCompletedDate: doc.data().lastCompletedDate || null,
        createdBy: doc.data().createdBy || "",
        assignedTo: doc.data().assignedTo || "",
        order: Number.isFinite(Number(doc.data().order)) ? Number(doc.data().order) : undefined,
        paused: Boolean(doc.data().paused),
      }));
      setHabits(fetchedHabits);
    });

    const unsubRewards = onSnapshot(rewardsRef, (snapshot: any) => {
      const fetchedRewards: Reward[] = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        title: doc.data().title || "",
        description: doc.data().description || "",
        cost: Number(doc.data().cost) || 50,
        claimed: Boolean(doc.data().claimed),
        approved: Boolean(doc.data().approved),
        rejected: Boolean(doc.data().rejected)
      }));
      setRewards(fetchedRewards);
    });

    const unsubAgreements = onSnapshot(agreementsRef, (snapshot: any) => {
      const fetchedAgreements: Agreement[] = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        title: doc.data().title || "",
        category: doc.data().category || "Acuerdo",
        description: doc.data().description || "",
        status: doc.data().status || "Aceptado",
      }));
      setAgreements(fetchedAgreements);
    });

    const unsubLogs = onSnapshot(logsRef, (snapshot: any) => {
      const fetchedLogs: ActivityLog[] = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        action: doc.data().action || "",
        timestamp: doc.data().timestamp || "",
        type: doc.data().type || "info",
      }));
      fetchedLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setActivityLogs(fetchedLogs);
    });

    const unsubDiary = onSnapshot(diaryRef, (snapshot: any) => {
      const fetchedDiary: DiaryEntry[] = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        authorId: doc.data().authorId || "",
        title: doc.data().title || doc.data().content?.split("\n")[0]?.slice(0, 80) || "Entrada de diario",
        subtitle: doc.data().subtitle || "",
        heading: doc.data().heading || "",
        body: doc.data().body || doc.data().content || "",
        authorName: doc.data().authorName || "",
        authorRole: doc.data().authorRole || "Sub",
        content: doc.data().content || doc.data().body || "",
        timestamp: doc.data().timestamp || ""
      }));
      fetchedDiary.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setDiaryEntries(fetchedDiary);
    });

    const unsubChat = onSnapshot(chatRef, (snapshot: any) => {
      const fetchedChat: ChatMessage[] = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        senderUid: doc.data().senderUid || "",
        senderName: doc.data().senderName || "",
        senderRole: doc.data().senderRole || "Sub",
        text: doc.data().text || "",
        timestamp: doc.data().timestamp || ""
      }));
      fetchedChat.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      setChatMessages(fetchedChat);
    });

    return () => {
      unsubConfig();
      unsubMembers();
      unsubTasks();
      unsubHabits();
      unsubRewards();
      unsubAgreements();
      unsubLogs();
      unsubDiary();
      unsubChat();
    };
  }, [user]);

  async function handleAuthSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAuthError("");

    try {
      if (isRegistering) {
        const userCredential = await createUserWithEmailAndPassword(auth, emailInput, passwordInput);
        const newUser = userCredential.user;

        const profileData: UserProfile = {
          uid: newUser.uid,
          email: emailInput,
          displayName: nameInput || emailInput.split("@")[0],
          role: roleInput,
          photoUrl: "",
          bio: "",
          limitsNote: ""
        };

        await setDoc(doc(db, "users", newUser.uid), profileData);
        await setDoc(
          doc(db, "dynamics", DYNAMIC_ID, "members", newUser.uid),
          {
            uid: newUser.uid,
            displayName: profileData.displayName,
            role: profileData.role,
            email: profileData.email,
            joinedAt: new Date().toISOString()
          },
          { merge: true }
        );
        setUserProfile(profileData);
        showToast("Cuenta creada exitosamente", "success");
      } else {
        await signInWithEmailAndPassword(auth, emailInput, passwordInput);
        showToast("Sesión iniciada correctamente", "success");
      }
    } catch (err: any) {
      setAuthError(err.message || "Error al autenticar");
      showToast("Error en la autenticación", "error");
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const userDocRef = doc(db, "users", user.uid);
    const updatedProfile = {
      ...userProfile,
      bio: editBio,
      photoUrl: editPhotoUrl,
      limitsNote: editLimits
    };
    await setDoc(userDocRef, updatedProfile, { merge: true });
    setUserProfile(updatedProfile as UserProfile);
    showToast("Perfil actualizado correctamente", "success");
  }

  const tabLabels: Record<typeof activeTab, string> = {
    dashboard: "Dashboard",
    tasks: "Tareas",
    habits: "Hábitos",
    rewards: "Recompensas",
    agreements: "Acuerdos y Límites",
    contract: "Contrato Digital",
    activity: "Registro de Actividad",
    diary: "Diario Compartido",
    chat: "Chat Directo",
    profile: "Perfil Ampliado",
  };

  const navigateToTab = (tab: typeof activeTab) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  async function handleLogout() {
    await signOut(auth);
    showToast("Sesión cerrada", "info");
  }

  async function logActivity(action: string, type: "info" | "reward" | "penalty" | "pause" = "info") {
    const logsRef = collection(db, "dynamics", DYNAMIC_ID, "activityLogs");
    await addDoc(logsRef, {
      action: `[${currentRole}] ${action}`,
      timestamp: new Date().toLocaleString(),
      type
    });
  }

  async function togglePause() {
    if (currentRole !== "Dominante") {
      alert("Solo el perfil Dominante / Admin puede pausar la dinámica.");
      return;
    }

    const newPauseState = !isPaused;
    const configRef = doc(db, "dynamics", DYNAMIC_ID);
    await setDoc(configRef, { isPaused: newPauseState }, { merge: true });
    await logActivity(
      newPauseState ? "Dinámica colocada en Pausa de Seguridad" : "Dinámica Reanudada", 
      "pause"
    );
    showToast(newPauseState ? "Dinámica en pausa" : "Dinámica reanudada", "warning");
  }

  async function signContract() {
    const timestamp = new Date().toLocaleString();
    const newSignature: ContractSignature = {
      signedBy: activeUserName,
      signedAt: timestamp,
      role: currentRole
    };

    const updatedSignatures = [...signatures, newSignature];
    const configRef = doc(db, "dynamics", DYNAMIC_ID);
    
    await setDoc(configRef, { signatures: updatedSignatures }, { merge: true });
    await logActivity(`El documento marco fue firmado por ${activeUserName} (${currentRole})`, "info");
    showToast("Documento firmado digitalmente con éxito", "success");
  }

  async function handleApplyPenalty() {
    if (currentRole !== "Dominante") {
      alert("Solo el perfil Dominante / Admin puede aplicar penalizaciones.");
      return;
    }

    if (isPaused) {
      alert("No se pueden aplicar penalizaciones mientras la dinámica está en Pausa.");
      return;
    }

    const reason = prompt("Motivo de la penalización / falta:");
    if (!reason) return;
    const penaltyPtsStr = prompt("Puntos a descontar (ej. 20):") || "20";
    const pts = parseInt(penaltyPtsStr, 10) || 0;

    await logActivity(`PENALIZACIÓN aplicada: ${reason} (-${pts} pts)`, "penalty");
    showToast(`Penalización registrada (-${pts} pts)`, "error");
  }

  async function toggleTask(id: string, currentCompletedStatus: boolean) {
    const task = tasks.find(t => t.id === id);
    if (currentRole === "Sub" && task?.assignedTo && task.assignedTo !== user?.uid) {
      showToast("Esta tarea está asignada a otro miembro.", "warning");
      return;
    }
    const taskDocRef = doc(db, "dynamics", DYNAMIC_ID, "tasks", id);
    const newStatus = !currentCompletedStatus;
    
    let evidenceUrl = "";
    if (newStatus && currentRole === "Sub") {
      const inputUrl = prompt("¿Deseas adjuntar un enlace de evidencia fotográfica para esta tarea? (Opcional):") || "";
      evidenceUrl = inputUrl;
    }

    await updateDoc(taskDocRef, { 
      completed: newStatus,
      ...(evidenceUrl ? { evidenceUrl } : {})
    });
    
    if (task && newStatus) {
      await logActivity(`Tarea completada por ${activeUserName}: "${task.title}" (+${task.points} pts)${evidenceUrl ? ' [Con Evidencia]' : ''}`, "info");
      showToast(`¡Tarea completada! +${task.points} pts`, "success");
    }
  }

  function resolveDefaultAssignee(): string {
    if (!user) return "";
    if (currentRole === "Sub") return user.uid;

    const subMember = members.find((member) => member.role === "Sub");
    return subMember?.uid || "";
  }

  function getMemberLabel(uid?: string) {
    if (!uid) return "Sin asignar";
    const member = members.find((item) => item.uid === uid);
    return member ? `${member.displayName} · ${member.role}` : "Miembro";
  }

  const partner = members.find((member) => member.uid !== user?.uid);
  const assignableMembers = currentRole === "Dominante"
    ? members.filter((member) => member.role === "Sub")
    : members.filter((member) => member.uid === user?.uid);

  function chooseAssignee(currentUid?: string): string {
    const candidates = assignableMembers;
    if (candidates.length === 0) return currentUid || resolveDefaultAssignee();
    if (candidates.length === 1) return candidates[0].uid;

    const menu = candidates
      .map((member, index) => `${index + 1}. ${member.displayName} (${member.role})`)
      .join("\n");
    const currentIndex = Math.max(0, candidates.findIndex((m) => m.uid === currentUid));
    const answer = prompt(`Asignar a:\n${menu}`, String(currentIndex + 1));
    if (answer === null) return currentUid || candidates[0].uid;
    const selected = candidates[Number(answer) - 1];
    return selected?.uid || currentUid || candidates[0].uid;
  }

  function sortByOrder<T extends { order?: number; id: string }>(items: T[]): T[] {
    return [...items].sort((a, b) => {
      const aOrder = a.order ?? Number.MAX_SAFE_INTEGER;
      const bOrder = b.order ?? Number.MAX_SAFE_INTEGER;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.id.localeCompare(b.id);
    });
  }

  function nextOrder<T extends { order?: number }>(items: T[]): number {
    const values = items.map((item) => item.order ?? 0);
    return (values.length ? Math.max(...values) : 0) + 1000;
  }

  async function persistTaskOrder(items: Task[]) {
    await Promise.all(
      items.map((item, index) =>
        updateDoc(doc(db, "dynamics", DYNAMIC_ID, "tasks", item.id), {
          order: (index + 1) * 1000
        })
      )
    );
  }

  async function persistHabitOrder(items: Habit[]) {
    await Promise.all(
      items.map((item, index) =>
        updateDoc(doc(db, "dynamics", DYNAMIC_ID, "habits", item.id), {
          order: (index + 1) * 1000
        })
      )
    );
  }


  async function dropTaskOn(targetTask: Task) {
    if (!draggedTaskId || draggedTaskId === targetTask.id) return;
    const dragged = tasks.find((item) => item.id === draggedTaskId);
    if (!dragged) return;

    // Main tasks can only be reordered with main tasks; subtasks only with siblings.
    if ((dragged.parentId || null) !== (targetTask.parentId || null)) {
      setDraggedTaskId(null);
      return;
    }

    const siblings = sortByOrder(
      tasks.filter((item) => (item.parentId || null) === (targetTask.parentId || null))
    );
    const from = siblings.findIndex((item) => item.id === dragged.id);
    const to = siblings.findIndex((item) => item.id === targetTask.id);
    if (from < 0 || to < 0) return;

    const [moved] = siblings.splice(from, 1);
    siblings.splice(to, 0, moved);
    setDraggedTaskId(null);
    await persistTaskOrder(siblings);
  }

  async function dropHabitOn(targetHabit: Habit) {
    if (!draggedHabitId || draggedHabitId === targetHabit.id) return;
    const ordered = sortByOrder(habits);
    const from = ordered.findIndex((item) => item.id === draggedHabitId);
    const to = ordered.findIndex((item) => item.id === targetHabit.id);
    if (from < 0 || to < 0) return;

    const [moved] = ordered.splice(from, 1);
    ordered.splice(to, 0, moved);
    setDraggedHabitId(null);
    await persistHabitOrder(ordered);
  }

  async function handleAddTask(parentId: string | null = null) {
    const title = prompt(parentId ? "Título de la Subtarea:" : "Título de la Tarea Principal:");
    if (!title) return;
    const description = prompt("Descripción:") || "";
    const pointsStr = prompt("Puntos:") || "10";

    const inheritedAssignee = parentId
      ? (tasks.find((task) => task.id === parentId)?.assignedTo || resolveDefaultAssignee())
      : resolveDefaultAssignee();
    const assignedTo = parentId ? inheritedAssignee : chooseAssignee(inheritedAssignee);

    const siblings = tasks.filter((item) => (item.parentId || null) === (parentId || null));
    const tasksRef = collection(db, "dynamics", DYNAMIC_ID, "tasks");
    await addDoc(tasksRef, {
      title,
      description,
      points: parseInt(pointsStr, 10) || 10,
      completed: false,
      parentId,
      createdByRole: currentRole,
      createdBy: user?.uid || "",
      assignedTo,
      evidenceUrl: "",
      order: nextOrder(siblings)
    });
    showToast("Tarea agregada correctamente", "success");
  }

  async function handleEditTask(task: Task) {
    if (currentRole === "Sub" && task.createdByRole === "Dominante") {
      alert("Esta tarea fue asignada por el Dominante y no puede ser editada por el Sub.");
      return;
    }

    const newTitle = prompt("Editar Título:", task.title);
    if (newTitle === null) return;
    const newDescription = prompt("Editar Descripción:", task.description) ?? "";
    const newPointsStr = prompt("Editar Puntos:", task.points.toString()) ?? "10";
    const newAssignedTo = task.parentId ? task.assignedTo : chooseAssignee(task.assignedTo);

    const taskRef = doc(db, "dynamics", DYNAMIC_ID, "tasks", task.id);
    await updateDoc(taskRef, {
      title: newTitle || task.title,
      description: newDescription,
      points: parseInt(newPointsStr, 10) || task.points,
      assignedTo: newAssignedTo || task.assignedTo || ""
    });
    showToast("Tarea actualizada", "success");
  }

  async function handleDeleteTask(task: Task) {
    if (currentRole === "Sub" && task.createdByRole === "Dominante") {
      alert("No tienes permiso para borrar tareas asignadas por el Dominante.");
      return;
    }

    if (confirm("¿Estás seguro de que deseas eliminar esta tarea y sus subtareas?")) {
      const subtasks = tasks.filter(t => t.parentId === task.id);
      for (const sub of subtasks) {
        await deleteDoc(doc(db, "dynamics", DYNAMIC_ID, "tasks", sub.id));
      }
      await deleteDoc(doc(db, "dynamics", DYNAMIC_ID, "tasks", task.id));
      showToast("Tarea eliminada", "info");
    }
  }

  async function handleAddHabit() {
    const title = prompt("Título del hábito:");
    if (!title) return;
    const subtitle = prompt("Subtítulo (opcional):") || "";
    const heading = prompt("Encabezado (opcional):") || "";
    const body = prompt("Cuerpo / descripción (opcional):") || "";
    const frequency = prompt("Frecuencia:", "Diaria") || "Diaria";
    const pointsStr = prompt("Puntos por cumplimiento diario:") || "10";

    const assignedTo = chooseAssignee(resolveDefaultAssignee());
    const habitsRef = collection(db, "dynamics", DYNAMIC_ID, "habits");
    await addDoc(habitsRef, {
      title, subtitle, heading, body, frequency,
      points: parseInt(pointsStr, 10) || 10,
      streak: 0,
      lastCompletedDate: null,
      createdBy: user?.uid || "",
      assignedTo,
      paused: false,
      order: nextOrder(habits)
    });
    showToast("Hábito creado", "success");
  }

  async function handleEditHabit(habit: Habit) {
    const display = getHabitDisplay(habit);
    const newTitle = prompt("Editar Título:", display.title);
    if (newTitle === null) return;
    const newSubtitle = prompt("Editar Subtítulo:", habit.subtitle ?? display.subtitle) ?? "";
    const newHeading = prompt("Editar Encabezado:", habit.heading ?? display.heading) ?? "";
    const newBody = prompt("Editar Cuerpo / descripción:", habit.body ?? display.body) ?? "";
    const newFrequency = prompt("Editar Frecuencia:", habit.frequency) ?? habit.frequency;
    const newPointsStr = prompt("Editar Puntos por día:", habit.points.toString()) ?? "10";
    const newAssignedTo = chooseAssignee(habit.assignedTo);

    const habitRef = doc(db, "dynamics", DYNAMIC_ID, "habits", habit.id);
    await updateDoc(habitRef, {
      title: newTitle || display.title,
      subtitle: newSubtitle,
      heading: newHeading,
      body: newBody,
      frequency: newFrequency || habit.frequency,
      points: parseInt(newPointsStr, 10) || habit.points,
      assignedTo: newAssignedTo || habit.assignedTo || ""
    });
    showToast("Hábito actualizado", "success");
  }

  async function handleDeleteHabit(habitId: string) {
    if (confirm("¿Eliminar este hábito? Perderás el registro de racha asociado.")) {
      await deleteDoc(doc(db, "dynamics", DYNAMIC_ID, "habits", habitId));
      showToast("Hábito eliminado", "info");
    }
  }

  async function toggleHabitPaused(habit: Habit) {
    await updateDoc(doc(db, "dynamics", DYNAMIC_ID, "habits", habit.id), {
      paused: !habit.paused
    });
    setOpenActionMenu(null);
    showToast(habit.paused ? "Hábito reactivado" : "Hábito pausado", "info");
  }

  async function toggleHabitToday(habit: Habit) {
    if (currentRole === "Sub" && habit.assignedTo && habit.assignedTo !== user?.uid) {
      showToast("Este hábito está asignado a otro miembro.", "warning");
      return;
    }
    const isCompletedToday = habit.lastCompletedDate === todayStr;
    const habitRef = doc(db, "dynamics", DYNAMIC_ID, "habits", habit.id);

    if (isCompletedToday) {
      await updateDoc(habitRef, {
        lastCompletedDate: null,
        streak: Math.max(0, habit.streak - 1)
      });
      showToast("Hábito desmarcado", "info");
    } else {
      await updateDoc(habitRef, {
        lastCompletedDate: todayStr,
        streak: habit.streak + 1
      });
      await logActivity(`Hábito cumplido por ${activeUserName}: "${habit.title}" (Racha: ${habit.streak + 1} 🔥)`, "info");
      showToast(`¡Hábito registrado! Racha: ${habit.streak + 1} 🔥`, "success");
    }
  }

  async function handleAddReward() {
    const title = prompt("Nombre de la Recompensa:");
    if (!title) return;
    const description = prompt("Descripción:") || "";
    const costStr = prompt("Costo en Puntos:") || "50";

    const rewardsRef = collection(db, "dynamics", DYNAMIC_ID, "rewards");
    await addDoc(rewardsRef, {
      title,
      description,
      cost: parseInt(costStr, 10) || 50,
      claimed: false,
      approved: false,
      rejected: false
    });
    showToast("Recompensa agregada al catálogo", "success");
  }

  async function handleEditReward(reward: Reward) {
    const newTitle = prompt("Editar Título:", reward.title);
    if (newTitle === null) return;
    const newDescription = prompt("Editar Descripción:", reward.description) ?? "";
    const newCostStr = prompt("Editar Costo en Puntos:", reward.cost.toString()) ?? "50";

    const rewardRef = doc(db, "dynamics", DYNAMIC_ID, "rewards", reward.id);
    await updateDoc(rewardRef, {
      title: newTitle || reward.title,
      description: newDescription,
      cost: parseInt(newCostStr, 10) || reward.cost
    });
    showToast("Recompensa actualizada", "success");
  }

  async function handleDeleteReward(rewardId: string) {
    if (confirm("¿Deseas eliminar esta recompensa del catálogo?")) {
      await deleteDoc(doc(db, "dynamics", DYNAMIC_ID, "rewards", rewardId));
      showToast("Recompensa eliminada", "info");
    }
  }

  async function requestClaimReward(reward: Reward) {
    if (availablePoints < reward.cost) {
      alert(`Puntos insuficientes. Necesitas ${reward.cost} pts y tienes ${availablePoints} pts.`);
      showToast("Puntos insuficientes para este canje", "error");
      return;
    }

    if (confirm(`¿Deseas solicitar el canje de "${reward.title}" por ${reward.cost} puntos?`)) {
      const rewardRef = doc(db, "dynamics", DYNAMIC_ID, "rewards", reward.id);
      await updateDoc(rewardRef, { claimed: true, approved: false, rejected: false });
      await logActivity(`Solicitud de canje: "${reward.title}" (${reward.cost} pts)`, "reward");
      showToast("Solicitud de canje enviada al Dominante", "warning");
    }
  }

  async function approveReward(reward: Reward) {
    if (currentRole !== "Dominante") return;
    const rewardRef = doc(db, "dynamics", DYNAMIC_ID, "rewards", reward.id);
    await updateDoc(rewardRef, { approved: true, rejected: false });
    await logActivity(`Canje APROBADO por Admin: "${reward.title}" (-${reward.cost} pts)`, "reward");
    showToast(`Canje aprobado: "${reward.title}"`, "success");
  }

  async function rejectReward(reward: Reward) {
    if (currentRole !== "Dominante") return;
    const rewardRef = doc(db, "dynamics", DYNAMIC_ID, "rewards", reward.id);
    await updateDoc(rewardRef, { claimed: false, approved: false, rejected: true });
    await logActivity(`Canje RECHAZADO por Admin: "${reward.title}"`, "reward");
    showToast(`Canje rechazado: "${reward.title}"`, "error");
  }

  async function handleAddAgreement() {
    const title = prompt("Título del acuerdo o límite:");
    if (!title) return;
    const category = prompt("Categoría: Escribe 'Acuerdo', 'Límite Duro' o 'Límite Blando'") as any;
    const description = prompt("Detalles o términos:") || "";

    const validCategory = ["Acuerdo", "Límite Duro", "Límite Blando"].includes(category) 
      ? category 
      : "Acuerdo";

    const agreementsRef = collection(db, "dynamics", DYNAMIC_ID, "agreements");
    await addDoc(agreementsRef, {
      title,
      category: validCategory,
      description,
      status: "Aceptado"
    });
    await logActivity(`Nuevo ${validCategory} registrado: "${title}"`, "info");
    showToast("Acuerdo/Límite registrado", "success");
  }

  async function handleEditAgreement(agreement: Agreement) {
    if (currentRole !== "Dominante") {
      alert("Solo el perfil Dominante / Admin puede editar acuerdos formalizados.");
      return;
    }

    const newTitle = prompt("Editar Título del Acuerdo/Límite:", agreement.title);
    if (newTitle === null) return;
    const newCategory = prompt("Categoría ('Acuerdo', 'Límite Duro', 'Límite Blando'):", agreement.category) as any;
    const newDescription = prompt("Editar Detalles:", agreement.description) ?? "";

    const validCategory = ["Acuerdo", "Límite Duro", "Límite Blando"].includes(newCategory) 
      ? newCategory 
      : agreement.category;

    const agreementRef = doc(db, "dynamics", DYNAMIC_ID, "agreements", agreement.id);
    await updateDoc(agreementRef, {
      title: newTitle || agreement.title,
      category: validCategory,
      description: newDescription
    });
    showToast("Acuerdo actualizado", "success");
  }

  async function handleDeleteAgreement(agreementId: string) {
    if (currentRole !== "Dominante") {
      alert("Solo el perfil Dominante / Admin puede eliminar acuerdos formalizados.");
      return;
    }

    if (confirm("¿Estás seguro de borrar este acuerdo o límite del registro?")) {
      await deleteDoc(doc(db, "dynamics", DYNAMIC_ID, "agreements", agreementId));
      showToast("Acuerdo eliminado", "info");
    }
  }

  async function handleAddDiaryEntry() {
    const title = prompt("Título de la entrada:");
    if (!title) return;
    const subtitle = prompt("Subtítulo (opcional):") || "";
    const heading = prompt("Encabezado (opcional):") || "";
    const body = prompt("Cuerpo de la entrada:") || "";

    const diaryRef = collection(db, "dynamics", DYNAMIC_ID, "diaryEntries");
    await addDoc(diaryRef, {
      title,
      subtitle,
      heading,
      body,
      content: body, // compatibilidad con la estructura anterior
      authorId: user?.uid || "",
      authorName: activeUserName,
      authorRole: currentRole,
      timestamp: new Date().toLocaleString()
    });
    showToast("Entrada agregada al diario", "success");
  }

  const toggleDiaryExpanded = (entryId: string) => {
    setExpandedDiaryEntries((prev) => ({
      ...prev,
      [entryId]: !prev[entryId],
    }));
  };

  async function handleSendChatMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!newChatText.trim()) return;

    const chatRef = collection(db, "dynamics", DYNAMIC_ID, "chatMessages");
    await addDoc(chatRef, {
      senderUid: user.uid,
      senderName: activeUserName,
      senderRole: currentRole,
      text: newChatText,
      timestamp: new Date().toISOString()
    });
    setNewChatText("");
  }

  const completedTasksCount = tasks.filter(t => t.completed).length;
  const completedHabitsTodayCount = habits.filter(h => h.lastCompletedDate === todayStr).length;
  
  const taskPoints = tasks.filter(t => t.completed).reduce((acc, t) => acc + t.points, 0);
  const habitPoints = habits.filter(h => h.lastCompletedDate === todayStr).reduce((acc, h) => acc + h.points, 0);
  
  const penaltyPoints = activityLogs
    .filter(log => log.type === "penalty")
    .reduce((acc, log) => {
      const match = log.action.match(/-(\d+)\s*pts/);
      return acc + (match ? parseInt(match[1], 10) : 0);
    }, 0);

  const grossPoints = taskPoints + habitPoints;
  const spentPoints = rewards.filter(r => r.claimed && r.approved).reduce((acc, r) => acc + r.cost, 0);
  const availablePoints = Math.max(0, grossPoints - spentPoints - penaltyPoints);
  const totalEarnedHistorical = grossPoints;

  const maxStreak = habits.length > 0 ? Math.max(...habits.map(h => h.streak)) : 0;
  
  const totalItemsToday = tasks.length + habits.length;
  const totalCompletedToday = completedTasksCount + completedHabitsTodayCount;

  const getSubRank = (points: number, streak: number) => {
    if (points >= 300 || streak >= 14) return { rank: "Maestro Devoto", color: "#ffd700", icon: "👑" };
    if (points >= 150 || streak >= 7) return { rank: "Constante", color: "#55ff88", icon: "⭐" };
    if (points >= 50 || streak >= 3) return { rank: "Disciplinado", color: "#55bbff", icon: "🛡️" };
    return { rank: "Novicio", color: "var(--text-muted)", icon: "🌱" };
  };

  const currentRankInfo = getSubRank(totalEarnedHistorical, maxStreak);

  const badgesList = [
    { id: "b1", title: "Novicio", desc: "Primeros pasos en la dinámica", icon: "🌱", unlocked: totalEarnedHistorical >= 0 },
    { id: "b2", title: "Disciplina I", desc: "Alcanza 50 puntos acumulados", icon: "🛡️", unlocked: totalEarnedHistorical >= 50 },
    { id: "b3", title: "Constante", desc: "Mantén una racha de 7 días", icon: "⭐", unlocked: maxStreak >= 7 },
    { id: "b4", title: "Devoto", desc: "Supera los 300 puntos acumulados", icon: "👑", unlocked: totalEarnedHistorical >= 300 }
  ];

  const rootTasks = sortByOrder(tasks.filter(t => !t.parentId));
  const getSubtasks = (parentId: string) =>
    sortByOrder(tasks.filter(t => t.parentId === parentId));
  const orderedHabits = sortByOrder(habits);

  const toggleTaskExpanded = (taskId: string) => {
    setExpandedTasks((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
  };

  const toggleHabitExpanded = (habitId: string) => {
    setExpandedHabits((prev) => ({
      ...prev,
      [habitId]: !prev[habitId],
    }));
  };

  const getHabitDisplay = (habit: Habit) => {
    if (habit.subtitle || habit.heading || habit.body) {
      return {
        title: habit.title,
        subtitle: habit.subtitle || `${habit.frequency} • Racha: ${habit.streak} 🔥`,
        heading: habit.heading || "Detalle del hábito",
        body: habit.body || "",
      };
    }

    const raw = habit.title.trim();
    const marker = "Mi enfoque diario:";
    const markerIndex = raw.indexOf(marker);
    const beforeFocus = markerIndex >= 0 ? raw.slice(0, markerIndex).trim() : raw;
    const focusBody = markerIndex >= 0 ? raw.slice(markerIndex + marker.length).trim() : "";
    const titleMatch = beforeFocus.match(
      /^((?:\\d+\\.\\s*)?.+?)(?=\\s+(?:Como|Establezco|Fijo|Le impongo|Yo decido)\\b)/
    );
    const title = titleMatch?.[1]?.trim() || beforeFocus;
    const description = beforeFocus.slice(title.length).trim();

    return {
      title,
      subtitle: `${habit.frequency} • Racha: ${habit.streak} 🔥`,
      heading: focusBody ? "Mi enfoque diario" : "Detalle del hábito",
      body: focusBody || description,
    };
  };
  const pendingRewards = rewards.filter(r => r.claimed && !r.approved);

  const getNextObedienteTask = (): Task | null => {
    const pending = tasks.filter(t => !t.completed);
    if (pending.length === 0) return null;
    const leaves = pending.filter(p => !tasks.some(child => child.parentId === p.id && !child.completed));
    return leaves[0] || pending[0];
  };

  const currentObedienteTask = getNextObedienteTask();

  if (authLoading) {
    return (
      <div className="app-shell" style={{ justifyContent: "center", alignItems: "center" }}>
        <p style={{ color: "var(--text-sub)" }}>Cargando sesión...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="app-shell" style={{ justifyContent: "center", alignItems: "center", padding: "20px" }}>
        <main style={{ maxWidth: "420px", width: "100%" }}>
          <div className="welcome-card" style={{ flexDirection: "column", padding: "32px", gap: "20px" }}>
            <div style={{ textAlign: "center" }}>
              <div className="brand-mark" style={{ margin: "0 auto 12px auto" }}>D</div>
              <h2 style={{ margin: 0 }}>{isRegistering ? "Crear Cuenta" : "Iniciar Sesión"}</h2>
              <p style={{ fontSize: "14px", color: "var(--text-muted)", marginTop: "4px" }}>Espacio Privado Dinámico</p>
            </div>

            {authError && (
              <div style={{ background: "#2c1717", border: "1px solid #a04848", color: "#ff8888", padding: "10px", borderRadius: "8px", fontSize: "12px" }}>
                {authError}
              </div>
            )}

            <form onSubmit={handleAuthSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {isRegistering && (
                <div>
                  <label style={{ fontSize: "12px", color: "var(--accent-text)", display: "block", marginBottom: "4px" }}>Nombre de Usuario</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="Ej. Alex"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    style={{ width: "100%", padding: "10px", background: "var(--bg-main)", border: "1px solid var(--border-hover)", borderRadius: "8px", color: "var(--text-main)" }}
                  />
                </div>
              )}

              <div>
                <label style={{ fontSize: "12px", color: "var(--accent-text)", display: "block", marginBottom: "4px" }}>Correo Electrónico</label>
                <input 
                  type="email" 
                  required 
                  placeholder="tu@email.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  style={{ width: "100%", padding: "10px", background: "var(--bg-main)", border: "1px solid var(--border-hover)", borderRadius: "8px", color: "var(--text-main)" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", color: "var(--accent-text)", display: "block", marginBottom: "4px" }}>Contraseña</label>
                <input 
                  type="password" 
                  required 
                  placeholder="••••••••"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  style={{ width: "100%", padding: "10px", background: "var(--bg-main)", border: "1px solid var(--border-hover)", borderRadius: "8px", color: "var(--text-main)" }}
                />
              </div>

              {isRegistering && (
                <div>
                  <label style={{ fontSize: "12px", color: "var(--accent-text)", display: "block", marginBottom: "4px" }}>Rol Asignado</label>
                  <select 
                    value={roleInput} 
                    onChange={(e) => setRoleInput(e.target.value as UserRole)}
                    style={{ width: "100%", padding: "10px", background: "var(--bg-main)", border: "1px solid var(--border-hover)", borderRadius: "8px", color: "var(--text-main)" }}
                  >
                    <option value="Sub">Sub</option>
                    <option value="Dominante">Dominante / Admin</option>
                  </select>
                </div>
              )}

              <button 
                type="submit" 
                className="secondary-button" 
                style={{ background: "var(--accent-primary)", color: "#fff", borderColor: "var(--accent-primary)", fontWeight: "bold", padding: "12px", marginTop: "8px", cursor: "pointer", justifyContent: "center" }}
              >
                {isRegistering ? "Registrarse" : "Entrar"}
              </button>
            </form>

            <button 
              className="secondary-button" 
              style={{ background: "transparent", borderColor: "transparent", color: "var(--text-muted)", fontSize: "13px" }}
              onClick={() => {
                setIsRegistering(!isRegistering);
                setAuthError("");
              }}
            >
              {isRegistering ? "¿Ya tienes cuenta? Inicia sesión" : "¿No tienes cuenta? Regístrate aquí"}
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (isObedienteActive) {
    return (
      <div className="app-shell" style={{ justifyContent: "center", alignItems: "center", padding: "20px" }}>
        <main style={{ maxWidth: "600px", width: "100%", textAlign: "center" }}>
          <div className="welcome-card" style={{ flexDirection: "column", gap: "24px", padding: "40px 30px" }}>
            <span className="status-pill" style={{ background: "var(--accent-bg)", borderColor: "var(--accent-primary)" }}>
              ⚡ MODO OBEDIENTE ACTIVO ({currentRole.toUpperCase()})
            </span>

            {currentObedienteTask ? (
              <>
                <div>
                  <p className="eyebrow">{currentObedienteTask.parentId ? "SUBTAREA EN CURSO" : "TAREA PRINCIPAL"}</p>
                  <h1 style={{ fontSize: "36px", margin: "10px 0", color: "var(--text-main)" }}>{currentObedienteTask.title}</h1>
                  <p style={{ color: "var(--text-sub)", fontSize: "16px" }}>{currentObedienteTask.description}</p>
                </div>

                <div style={{ background: "var(--bg-card)", padding: "16px", borderRadius: "12px", border: "1px solid var(--border-color)" }}>
                  <span style={{ color: "var(--accent-text)", fontWeight: "bold" }}>Recompensa: +{currentObedienteTask.points} Puntos</span>
                </div>

                <button 
                  className="secondary-button" 
                  style={{ background: "var(--accent-text)", color: "var(--bg-main)", fontWeight: "bold", padding: "16px 28px", fontSize: "16px", borderRadius: "12px", cursor: "pointer", width: "100%", justifyContent: "center" }}
                  onClick={() => toggleTask(currentObedienteTask.id, false)}
                >
                  ✓ Completar y Siguiente
                </button>
              </>
            ) : (
              <div>
                <h2>✨ ¡Todas las tareas completadas!</h2>
                <p style={{ color: "var(--text-sub)" }}>No hay más tareas pendientes por ejecutar.</p>
              </div>
            )}

            <button 
              className="secondary-button" 
              style={{ background: "transparent", borderColor: "var(--border-hover)", color: "var(--text-muted)", width: "100%", justifyContent: "center" }}
              onClick={() => setIsObedienteActive(false)}
            >
              ← Salir al Dashboard
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {/* Contenedor de Notificaciones Toast Flotantes */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast-message ${toast.type}`}>
            <span>
              {toast.type === "success" ? "✓" : toast.type === "warning" ? "⚠" : toast.type === "error" ? "✕" : "ℹ"}
            </span>
            <span>{toast.text}</span>
          </div>
        ))}
      </div>

      <aside className="sidebar">
        <div>
          <div className="brand">
            <div className="brand-mark">D</div>
            <div>
              <strong>DYNAMIC</strong>
              <span>PRIVATE SPACE</span>
            </div>
          </div>

          <div style={{ margin: "10px 0 14px", width: "100%", minWidth: 0 }}>
            <button
              className="secondary-button"
              onClick={() => setIsPartnerCardOpen((prev) => !prev)}
              style={{
                width: "100%",
                minWidth: 0,
                padding: "10px 11px",
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) 20px",
                alignItems: "center",
                gap: "8px",
                textAlign: "left",
                whiteSpace: "normal",
                overflow: "hidden",
              }}
              aria-expanded={isPartnerCardOpen}
              aria-label="Información de nuestra dinámica"
            >
              <span style={{ minWidth: 0, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "3px", overflow: "hidden" }}>
                <span style={{ width: "100%", fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", lineHeight: 1.2, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                  NUESTRA DINÁMICA
                </span>
                <span style={{ width: "100%", minWidth: 0, display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 650, lineHeight: 1.25, color: "var(--text-main)", overflow: "hidden" }}>
                  <span aria-hidden="true" style={{ flex: "0 0 auto", width: "7px", height: "7px", borderRadius: "999px", background: partner ? "var(--accent-primary)" : "var(--text-muted)" }} />
                  <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {partner ? partner.displayName : "Esperando miembro"}
                  </span>
                </span>
              </span>
              <span aria-hidden="true" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "20px", height: "20px", fontSize: "16px", lineHeight: 1, flexShrink: 0 }}>
                {isPartnerCardOpen ? "⌃" : "⌄"}
              </span>
            </button>

            {isPartnerCardOpen && partner && (
              <div style={{ marginTop: "7px", padding: "10px 11px", border: "1px solid var(--border-color)", borderRadius: "10px", background: "var(--bg-card)", fontSize: "12px", overflow: "hidden" }}>
                <strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {partner.displayName}
                </strong>
                <span style={{ color: "var(--text-muted)" }}>
                  {partner.role} · conectado a esta dinámica
                </span>
              </div>
            )}
          </div>

          <div
            className="quick-controls"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "20px",
              width: "100%",
            }}
          >
            <button
              onClick={toggleTheme}
              className="secondary-button"
              style={{
                width: "42px",
                height: "42px",
                padding: "0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
              title={isDarkMode ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
              aria-label={isDarkMode ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            >
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "20px",
                  lineHeight: "1",
                  width: "20px",
                  height: "20px",
                }}
              >
                {isDarkMode ? "🌙" : "☀️"}
              </span>
            </button>

            <button
              onClick={() => setIsObedienteActive((prev) => !prev)}
              className="secondary-button"
              style={{
                width: "42px",
                height: "42px",
                padding: "0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                background: isObedienteActive ? "var(--accent-primary)" : undefined,
                color: isObedienteActive ? "#ffffff" : undefined,
                borderColor: isObedienteActive ? "var(--accent-primary)" : undefined,
              }}
              title={isObedienteActive ? "Desactivar modo obediente" : "Activar modo obediente"}
              aria-label={isObedienteActive ? "Desactivar modo obediente" : "Activar modo obediente"}
            >
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "20px",
                  lineHeight: "1",
                  width: "20px",
                  height: "20px",
                }}
              >
                ⚡
              </span>
            </button>

            <button
              onClick={togglePause}
              className="secondary-button"
              style={{
                width: "42px",
                height: "42px",
                padding: "0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                background: isPaused ? "#8f3030" : "var(--accent-bg)",
                color: isPaused ? "#ffffff" : "var(--accent-text)",
                borderColor: isPaused ? "#a84444" : "var(--accent-primary)",
              }}
              title={isPaused ? "Reanudar dinámica" : "Pausar dinámica"}
              aria-label={isPaused ? "Reanudar dinámica" : "Pausar dinámica"}
            >
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "18px",
                  lineHeight: "1",
                  width: "20px",
                  height: "20px",
                }}
              >
                {isPaused ? "🔴" : "🟢"}
              </span>
            </button>
          </div>

          {/* Navegación principal de escritorio */}
 <nav
  id="primary-navigation"
  className={`navigation ${isMobileMenuOpen ? "mobile-open" : ""}`}
>
  {APP_SECTIONS.map((section) => {
    const isSectionActive = section.tabs.includes(activeTab);
const isSectionOpen =
  openNavSection === section.id || isSectionActive;
    return (
      <div
        key={section.id}
        className={`nav-section ${isSectionActive ? "active" : ""}`}
      >
       <button
  type="button"
  className={`nav-section-header ${
    isSectionActive ? "active" : ""
  }`}
  onClick={() =>
    setOpenNavSection((current) =>
      current === section.id ? null : section.id
    )
  }
  aria-expanded={isSectionOpen}
>
  <span>{section.label}</span>

  <span
    className={`nav-section-chevron ${
      isSectionOpen ? "open" : ""
    }`}
    aria-hidden="true"
  >
    ⌄
  </span>
</button>

  <div
  className={`nav-subitems ${
    isSectionOpen ? "open" : ""
  }`}
>
          {section.tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              className={`nav-subitem ${
                activeTab === tab ? "active" : ""
              }`}
              onClick={() => navigateToTab(tab)}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>
      </div>
    );
  })}
</nav>
        </div>

        <div className="sidebar-bottom">
          <button className="nav-item" onClick={handleLogout} style={{ color: "var(--text-sub)", width: "100%" }}>
            <span className="nav-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </span> 
            Cerrar Sesión
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">ESPACIO PRIVADO</p>
            <h1>Nuestra dinámica</h1>
          </div>
        </header>

        {currentRole === "Dominante" && pendingRewards.length > 0 && (
          <section className="welcome-card" style={{ borderColor: "var(--border-hover)", background: isDarkMode ? "var(--bg-card)" : "var(--bg-card)", marginBottom: "20px" }}>
            <div>
              <p className="eyebrow" style={{ color: "var(--accent-text)" }}>SOLICITUDES PENDIENTES</p>
              <h2 style={{ color: "var(--text-main)" }}>Buzón de Canjes por Aprobar ({pendingRewards.length})</h2>
              <p style={{ color: "var(--text-sub)" }}>El Sub ha solicitado canjear las siguientes recompensas:</p>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%", marginTop: "12px" }}>
              {pendingRewards.map((reward) => (
                <div key={reward.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-main)", padding: "12px 16px", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
                  <div>
                    <strong style={{ color: "var(--text-main)" }}>{reward.title}</strong>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Costo: {reward.cost} pts</div>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button className="secondary-button" style={{ background: "var(--accent-primary)", color: "#fff" }} onClick={() => approveReward(reward)}>
                      Aprobar
                    </button>
                    <button className="secondary-button" style={{ background: "transparent", color: "var(--text-sub)" }} onClick={() => rejectReward(reward)}>
                      Rechazar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="welcome-card" style={{ borderColor: isPaused ? "var(--accent-primary)" : "var(--border-color)" }}>
          <div>
            <p className="eyebrow">{isPaused ? "SISTEMA EN PAUSA" : "HOY"}</p>
            <h2>{isPaused ? "Dinámica Suspendida Temporalmente" : "Tu espacio de progreso"}</h2>
            <p>
              {isPaused 
                ? "Las consecuencias y la pérdida de rachas están desactivadas por pausa de dinámica." 
                : "Gestiona tareas, hábitos, puntos, acuerdos y objetivos desde un único lugar."}
            </p>
          </div>

        </section>

        <div className="mobile-navigation">
          <button
            type="button"
            className="mobile-menu-toggle"
            onClick={() => setIsMobileMenuOpen((open) => !open)}
            aria-expanded={isMobileMenuOpen}
            aria-controls="primary-navigation"
          >
            <span className="mobile-menu-toggle__icon" aria-hidden="true">
              {isMobileMenuOpen ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="18" y1="6" x2="6" y2="18" />
                </svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <line x1="4" y1="7" x2="20" y2="7" />
                  <line x1="4" y1="12" x2="20" y2="12" />
                  <line x1="4" y1="17" x2="20" y2="17" />
                </svg>
              )}
            </span>
            <span className="mobile-menu-toggle__label">{tabLabels[activeTab]}</span>
            <svg
              className={`mobile-menu-toggle__chevron ${isMobileMenuOpen ? "open" : ""}`}
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          <nav
            id="primary-navigation"
            className={`navigation ${isMobileMenuOpen ? "mobile-open" : ""}`}
          >
            <button className={`nav-item ${activeTab === "dashboard" ? "active" : ""}`} onClick={() => navigateToTab("dashboard")}>
              <span className="nav-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>
              </span> 
              Dashboard
            </button>

            <button className={`nav-item ${activeTab === "tasks" ? "active" : ""}`} onClick={() => navigateToTab("tasks")}>
              <span className="nav-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
              </span> 
              Tareas
            </button>

            <button className={`nav-item ${activeTab === "habits" ? "active" : ""}`} onClick={() => navigateToTab("habits")}>
              <span className="nav-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
              </span> 
              Hábitos
            </button>

            <button className={`nav-item ${activeTab === "rewards" ? "active" : ""}`} onClick={() => navigateToTab("rewards")}>
              <span className="nav-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>
              </span> 
              Recompensas {pendingRewards.length > 0 && <span style={{ background: "var(--accent-primary)", color: "#fff", padding: "2px 6px", borderRadius: "8px", fontSize: "10px", marginLeft: "auto" }}>{pendingRewards.length}</span>}
            </button>

            <button className={`nav-item ${activeTab === "agreements" ? "active" : ""}`} onClick={() => navigateToTab("agreements")}>
              <span className="nav-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </span> 
              Acuerdos y Límites
            </button>

            <button className={`nav-item ${activeTab === "diary" ? "active" : ""}`} onClick={() => navigateToTab("diary")}>
              <span className="nav-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
              </span> 
              Diario Compartido
            </button>

            <button className={`nav-item ${activeTab === "chat" ? "active" : ""}`} onClick={() => navigateToTab("chat")}>
              <span className="nav-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              </span> 
              Chat Directo
            </button>

            <button className={`nav-item ${activeTab === "contract" ? "active" : ""}`} onClick={() => navigateToTab("contract")}>
              <span className="nav-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              </span> 
              Contrato Digital
            </button>

            <button className={`nav-item ${activeTab === "activity" ? "active" : ""}`} onClick={() => navigateToTab("activity")}>
              <span className="nav-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </span> 
              Registro de Actividad
            </button>

            <button className={`nav-item ${activeTab === "profile" ? "active" : ""}`} onClick={() => navigateToTab("profile")}>
              <span className="nav-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              </span> 
              Perfil Ampliado
            </button>
          </nav>
        </div>

        <section className="stats-grid">
          <div className="stat-card">
            <span>COMPLETADOS</span>
            <strong>{totalCompletedToday}</strong>
            <small>de {totalItemsToday} ítems hoy</small>
          </div>

          <div className="stat-card">
            <span>PUNTOS DISPONIBLES</span>
            <strong>{availablePoints}</strong>
            <small>gastados: {spentPoints} | pen: -{penaltyPoints}</small>
          </div>

          <div className="stat-card">
            <span>MÁXIMA RACHA</span>
            <strong>{maxStreak} 🔥</strong>
            <small>días consecutivos</small>
          </div>

          <div className="stat-card">
            <span>RANGO ACTUAL</span>
            <strong style={{ color: currentRankInfo.color }}>{currentRankInfo.icon} {currentRankInfo.rank}</strong>
            <small>nivel automático</small>
          </div>
        </section>

        <section className="content-grid">
          <div className="panel">
            {activeTab === "profile" ? (
              <>
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">CONFIGURACIÓN DE IDENTIDAD</p>
                    <h2>Perfil Ampliado y Fotografía</h2>
                  </div>
                </div>

                <form onSubmit={handleSaveProfile} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div>
                    <label style={{ fontSize: "12px", color: "var(--accent-text)", display: "block", marginBottom: "4px" }}>URL de Fotografía de Perfil</label>
                    <input 
                      type="url" 
                      placeholder="https://ejemplo.com/mi-foto.jpg"
                      value={editPhotoUrl}
                      onChange={(e) => setEditPhotoUrl(e.target.value)}
                      style={{ width: "100%", padding: "10px", background: "var(--bg-main)", border: "1px solid var(--border-hover)", borderRadius: "8px", color: "var(--text-main)" }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: "12px", color: "var(--accent-text)", display: "block", marginBottom: "4px" }}>Biografía o Descripción Personal</label>
                    <textarea 
                      rows={3}
                      placeholder="Breve descripción o intenciones dentro de la dinámica..."
                      value={editBio}
                      onChange={(e) => setEditBio(e.target.value)}
                      style={{ width: "100%", padding: "10px", background: "var(--bg-main)", border: "1px solid var(--border-hover)", borderRadius: "8px", color: "var(--text-main)", resize: "vertical" }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: "12px", color: "var(--accent-text)", display: "block", marginBottom: "4px" }}>Límites y Notas Especiales de Perfil</label>
                    <textarea 
                      rows={2}
                      placeholder="Preferencias o restricciones particulares..."
                      value={editLimits}
                      onChange={(e) => setEditLimits(e.target.value)}
                      style={{ width: "100%", padding: "10px", background: "var(--bg-main)", border: "1px solid var(--border-hover)", borderRadius: "8px", color: "var(--text-main)", resize: "vertical" }}
                    />
                  </div>

                  {/* VALORACIÓN DEL DOMINANTE — SOLO INTERFAZ VISUAL POR AHORA */}
                  <div
                    style={{
                      marginTop: "8px",
                      paddingTop: "20px",
                      borderTop: "1px solid var(--border-color)"
                    }}
                  >
                    <div style={{ marginBottom: "18px" }}>
                      <p className="eyebrow" style={{ marginBottom: "6px" }}>
                        VALORACIÓN DEL DOMINANTE
                      </p>

                      <h3
                        style={{
                          margin: 0,
                          fontSize: "20px",
                          color: "var(--text-main)"
                        }}
                      >
                        Reconoce los aspectos que más destacan
                      </h3>

                      <p
                        style={{
                          margin: "6px 0 0",
                          color: "var(--text-muted)",
                          fontSize: "13px",
                          lineHeight: "1.5"
                        }}
                      >
                        Valora desde tu propia experiencia aquellos aspectos de la dinámica
                        que consideras más significativos.
                      </p>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                        gap: "14px"
                      }}
                    >
                      {[
                        {
                          icon: "🧭",
                          title: "Guía",
                          description:
                            "Capacidad para orientar la dinámica, proponer dirección y acompañar el desarrollo de la relación."
                        },
                        {
                          icon: "🛡️",
                          title: "Protector",
                          description:
                            "Atención al cuidado, seguridad, límites y bienestar dentro de la dinámica."
                        },
                        {
                          icon: "🪞",
                          title: "Introspectivo",
                          description:
                            "Capacidad de observar, reflexionar y comprender cómo evoluciona la dinámica y su propio papel."
                        },
                        {
                          icon: "🎨",
                          title: "Creativo",
                          description:
                            "Capacidad para crear tareas, experiencias y propuestas originales."
                        }
                      ].map((rating) => (
                        <div
                          key={rating.title}
                          style={{
                            padding: "16px",
                            background: "var(--bg-main)",
                            border: "1px solid var(--border-hover)",
                            borderRadius: "12px"
                          }}
                        >
                          <div
                            style={{
                              fontSize: "28px",
                              marginBottom: "8px"
                            }}
                          >
                            {rating.icon}
                          </div>

                          <h4
                            style={{
                              margin: "0 0 6px",
                              fontSize: "16px",
                              color: "var(--text-main)"
                            }}
                          >
                            {rating.title}
                          </h4>

                          <p
                            style={{
                              margin: "0 0 12px",
                              fontSize: "12px",
                              lineHeight: "1.5",
                              color: "var(--text-muted)"
                            }}
                          >
                            {rating.description}
                          </p>

                          <div style={{ display: "flex", gap: "4px" }}>
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                type="button"
                                title={`${star} de 5 estrellas`}
                                aria-label={`${star} de 5 estrellas`}
                                style={{
                                  border: "none",
                                  background: "transparent",
                                  padding: "2px",
                                  cursor: "pointer",
                                  fontSize: "22px",
                                  lineHeight: "1",
                                  color: "var(--accent-primary)"
                                }}
                              >
                                ☆
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button type="submit" className="secondary-button" style={{ background: "var(--accent-primary)", color: "#fff", fontWeight: "bold", padding: "12px", justifyContent: "center" }}>
                    Guardar Cambios de Perfil
                  </button>
                </form>
              </>
            ) : activeTab === "chat" ? (
              <>
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">COMUNICACIÓN DIRECTA</p>
                    <h2>Chat de la Dinámica</h2>
                  </div>
                </div>

                <div className="chat-container">
                  <div className="chat-messages">
                    {chatMessages.length === 0 ? (
                      <p style={{ color: "var(--text-muted)", textAlign: "center", marginTop: "40px" }}>No hay mensajes en el chat todavía. ¡Inicia la conversación!</p>
                    ) : (
                      chatMessages.map((msg) => {
                        const isMine = msg.senderUid === user.uid;
                        return (
                          <div key={msg.id} className={`chat-bubble ${isMine ? "mine" : "theirs"}`}>
                            <div style={{ fontSize: "10px", opacity: 0.8, marginBottom: "2px", fontWeight: "bold" }}>
                              {msg.senderName} ({msg.senderRole})
                            </div>
                            <div>{msg.text}</div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <form onSubmit={handleSendChatMessage} className="chat-input-area">
                    <input 
                      type="text" 
                      placeholder="Escribe un mensaje..."
                      value={newChatText}
                      onChange={(e) => setNewChatText(e.target.value)}
                      style={{ flex: 1, padding: "10px", background: "var(--bg-card)", border: "1px solid var(--border-hover)", borderRadius: "8px", color: "var(--text-main)" }}
                    />
                    <button type="submit" className="secondary-button" style={{ background: "var(--accent-primary)", color: "#fff", fontWeight: "bold" }}>
                      Enviar
                    </button>
                  </form>
                </div>
              </>
            ) : activeTab === "diary" ? (
              <>
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">BITÁCORA MUTUA</p>
                    <h2>Diario Compartido</h2>
                    <p style={{
                      margin: "5px 0 0",
                      color: "var(--text-muted)",
                      fontSize: "12px",
                      lineHeight: 1.45,
                    }}>
                      Una memoria cronológica construida entre ambos.
                    </p>
                  </div>
                  <button className="secondary-button" onClick={handleAddDiaryEntry}>
                    + Nueva entrada
                  </button>
                </div>

                {diaryEntries.length === 0 ? (
                  <div style={{
                    padding: "24px",
                    border: "1px dashed var(--border-color)",
                    borderRadius: "12px",
                    textAlign: "center",
                    color: "var(--text-muted)",
                  }}>
                    <div style={{ fontSize: "13px", fontWeight: 650, color: "var(--text-sub)" }}>
                      El diario todavía está vacío
                    </div>
                    <div style={{ marginTop: "5px", fontSize: "12px", lineHeight: 1.5 }}>
                      La primera entrada iniciará la memoria compartida de la dinámica.
                    </div>
                  </div>
                ) : (
                  <div style={{ position: "relative", paddingLeft: "22px" }}>
                    <div
                      aria-hidden="true"
                      style={{
                        position: "absolute",
                        left: "7px",
                        top: "12px",
                        bottom: "12px",
                        width: "1px",
                        background: "var(--border-color)",
                      }}
                    />

                    {diaryEntries.map((entry, entryIndex) => {
                      const isExpanded = !!expandedDiaryEntries[entry.id];
                      const authorInitial = (entry.authorName || "?").trim().charAt(0).toUpperCase();
                      const hasDetail = !!(entry.heading || entry.body || entry.content);

                      return (
                        <div
                          key={entry.id}
                          style={{
                            position: "relative",
                            marginBottom: entryIndex === diaryEntries.length - 1 ? 0 : "12px",
                          }}
                        >
                          <div
                            aria-hidden="true"
                            title={entry.authorName}
                            style={{
                              position: "absolute",
                              left: "-22px",
                              top: "15px",
                              width: "15px",
                              height: "15px",
                              borderRadius: "50%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              background: "var(--bg-card)",
                              border: "2px solid var(--accent-primary)",
                              color: "var(--accent-text)",
                              fontSize: "7px",
                              fontWeight: 800,
                              zIndex: 2,
                            }}
                          >
                            {authorInitial}
                          </div>

                          <article
                            className="diary-entry-card"
                            style={{
                              padding: "14px",
                              borderRadius: "11px",
                              transition: "border-color 160ms ease, box-shadow 160ms ease",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                gap: "12px",
                                alignItems: "flex-start",
                              }}
                            >
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "7px",
                                    flexWrap: "wrap",
                                    marginBottom: "5px",
                                  }}
                                >
                                  <span
                                    style={{
                                      color: "var(--accent-text)",
                                      fontSize: "10px",
                                      fontWeight: 750,
                                      letterSpacing: "0.04em",
                                    }}
                                  >
                                    {entry.authorName}
                                  </span>
                                  <span
                                    aria-hidden="true"
                                    style={{
                                      width: "3px",
                                      height: "3px",
                                      borderRadius: "50%",
                                      background: "var(--text-muted)",
                                      opacity: 0.55,
                                    }}
                                  />
                                  <span style={{ color: "var(--text-muted)", fontSize: "10px" }}>
                                    {entry.timestamp}
                                  </span>
                                </div>

                                <strong
                                  style={{
                                    display: "block",
                                    color: "var(--text-main)",
                                    fontSize: "15px",
                                    lineHeight: 1.35,
                                  }}
                                >
                                  {entry.title || "Entrada de diario"}
                                </strong>

                                {entry.subtitle && (
                                  <span
                                    style={{
                                      display: "block",
                                      marginTop: "4px",
                                      color: "var(--text-muted)",
                                      fontSize: "12px",
                                      lineHeight: 1.45,
                                    }}
                                  >
                                    {entry.subtitle}
                                  </span>
                                )}

                                {isExpanded && (
                                  <div
                                    style={{
                                      marginTop: "14px",
                                      paddingTop: "13px",
                                      borderTop: "1px solid var(--border-color)",
                                    }}
                                  >
                                    {entry.heading && (
                                      <div style={{ marginBottom: "12px" }}>
                                        <div
                                          style={{
                                            marginBottom: "5px",
                                            color: "var(--text-muted)",
                                            fontSize: "10px",
                                            fontWeight: 700,
                                            letterSpacing: "0.09em",
                                            textTransform: "uppercase",
                                          }}
                                        >
                                          Encabezado
                                        </div>
                                        <div
                                          style={{
                                            color: "var(--accent-text)",
                                            fontSize: "12px",
                                            fontWeight: 700,
                                            lineHeight: 1.45,
                                          }}
                                        >
                                          {entry.heading}
                                        </div>
                                      </div>
                                    )}

                                    {(entry.body || entry.content) && (
                                      <div>
                                        <div
                                          style={{
                                            marginBottom: "5px",
                                            color: "var(--text-muted)",
                                            fontSize: "10px",
                                            fontWeight: 700,
                                            letterSpacing: "0.09em",
                                            textTransform: "uppercase",
                                          }}
                                        >
                                          Cuerpo
                                        </div>
                                        <div
                                          style={{
                                            color: "var(--text-sub)",
                                            fontSize: "13px",
                                            lineHeight: 1.65,
                                            whiteSpace: "pre-wrap",
                                          }}
                                        >
                                          {entry.body || entry.content}
                                        </div>
                                      </div>
                                    )}

                                    <div
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "7px",
                                        flexWrap: "wrap",
                                        marginTop: "14px",
                                        paddingTop: "10px",
                                        borderTop: "1px solid var(--border-color)",
                                        color: "var(--text-muted)",
                                        fontSize: "10px",
                                      }}
                                    >
                                      <span>{entry.authorName}</span>
                                      <span aria-hidden="true">·</span>
                                      <span>{entry.authorRole}</span>
                                      <span aria-hidden="true">·</span>
                                      <span>{entry.timestamp}</span>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {hasDetail && (
                                <button
                                  className="secondary-button"
                                  style={{
                                    width: "34px",
                                    height: "34px",
                                    minWidth: "34px",
                                    padding: 0,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    borderRadius: "10px",
                                  }}
                                  onClick={() => toggleDiaryExpanded(entry.id)}
                                  title={isExpanded ? "Ocultar detalle" : "Mostrar detalle"}
                                  aria-label={isExpanded ? "Ocultar detalle" : "Mostrar detalle"}
                                  aria-expanded={isExpanded}
                                >
                                  <svg
                                    width="20"
                                    height="20"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                    style={{
                                      display: "block",
                                      transition: "transform 180ms ease",
                                      transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                                    }}
                                  >
                                    <polyline points="6 9 12 15 18 9" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </article>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : activeTab === "activity" ? (
              <>
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">AUDITORÍA DE EVENTOS</p>
                    <h2>Historial de Actividad</h2>
                  </div>
                  {currentRole === "Dominante" && (
                    <button className="secondary-button" style={{ background: "var(--bg-hover)", color: "var(--text-main)" }} onClick={handleApplyPenalty}>
                      Aplicar Penalización
                    </button>
                  )}
                </div>

                {activityLogs.length === 0 ? (
                  <p style={{ color: "var(--text-muted)" }}>No hay registros de actividad aún.</p>
                ) : (
                  <div className="task-list">
                    {activityLogs.map((log) => (
                      <div key={log.id} className="task-card">
                        <div className="task-information">
                          <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "4px" }}>
                            <span style={{ background: "var(--accent-bg)", color: "var(--accent-text)", fontSize: "10px", padding: "2px 6px", borderRadius: "4px", fontWeight: "bold" }}>
                              {log.type.toUpperCase()}
                            </span>
                            <strong style={{ color: "var(--text-main)" }}>{log.action}</strong>
                          </div>
                          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{log.timestamp}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : activeTab === "contract" ? (
              <>
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">DOCUMENTO CONSOLIDADO</p>
                    <h2>Contrato de Acuerdos</h2>
                  </div>
                  <button className="secondary-button" style={{ background: "var(--accent-primary)", color: "#fff" }} onClick={signContract}>
                    Firmar como {activeUserName}
                  </button>
                </div>

                <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "12px", padding: "24px", color: "var(--text-sub)", lineHeight: "1.6" }}>
                  <h3 style={{ marginTop: 0, color: "var(--text-main)", borderBottom: "1px solid var(--border-color)", paddingBottom: "10px" }}>
                    Acuerdo Marco de Dinámica
                  </h3>
                  
                  <p>Este documento consolida todos los acuerdos, límites y reglas aceptadas mutuamente para la dinámica activa.</p>

                  <h4 style={{ color: "var(--accent-text)", marginTop: "20px" }}>1. Términos y Acuerdos Registrados:</h4>
                  {agreements.length === 0 ? (
                    <p style={{ color: "var(--text-muted)" }}>No hay acuerdos registrados actualmente.</p>
                  ) : (
                    <ul style={{ paddingLeft: "20px" }}>
                      {agreements.map((a) => (
                        <li key={a.id} style={{ marginBottom: "8px" }}>
                          <strong style={{ color: "var(--text-main)" }}>[{a.category}] {a.title}:</strong> {a.description || "Sin descripción adicional"}
                        </li>
                      ))}
                    </ul>
                  )}

                  <h4 style={{ color: "var(--accent-text)", marginTop: "20px" }}>2. Firmas Digitales Registradas:</h4>
                  {signatures.length === 0 ? (
                    <p style={{ color: "var(--text-muted)" }}>Aún no hay firmas registradas en este documento.</p>
                  ) : (
                    <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "10px" }}>
                      {signatures.map((sig, idx) => (
                        <div key={idx} style={{ background: "var(--bg-main)", border: "1px dashed var(--accent-primary)", padding: "10px 16px", borderRadius: "8px", fontSize: "12px" }}>
                          <span style={{ color: "var(--accent-text)", fontWeight: "bold" }}>Firmado Digitalmente</span>
                          <div><strong style={{ color: "var(--text-main)" }}>Por:</strong> {sig.signedBy} ({sig.role})</div>
                          <div style={{ color: "var(--text-muted)" }}><strong>Fecha:</strong> {sig.signedAt}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : activeTab === "agreements" ? (
              <>
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">CONSENTIMIENTO Y MARCO</p>
                    <h2>Acuerdos y Límites</h2>
                  </div>
                  <button className="secondary-button" onClick={handleAddAgreement}>+ Nuevo Registro</button>
                </div>

                {agreements.length === 0 ? (
                  <p style={{ color: "var(--text-muted)" }}>No hay acuerdos o límites definidos aún.</p>
                ) : (
                  <div className="task-list">
                    {agreements.map((agreement) => (
                      <div key={agreement.id} className="task-card">
                        <div className="task-information">
                          <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "4px" }}>
                            <span style={{ background: "var(--accent-bg)", color: "var(--accent-text)", fontSize: "10px", padding: "2px 6px", borderRadius: "4px", fontWeight: "bold" }}>
                              {agreement.category}
                            </span>
                            <strong>{agreement.title}</strong>
                          </div>
                          <span>{agreement.description || "Sin especificaciones adicionales"}</span>
                        </div>
                        
                        {currentRole === "Dominante" && (
                          <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                            <button className="secondary-button" style={{ padding: "4px 8px", fontSize: "11px" }} onClick={() => handleEditAgreement(agreement)} title="Editar">
                              ✎
                            </button>
                            <button className="secondary-button" style={{ padding: "4px 8px", fontSize: "11px", color: "var(--text-muted)" }} onClick={() => handleDeleteAgreement(agreement.id)} title="Eliminar">
                              ✕
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : activeTab === "rewards" ? (
              <>
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">CATÁLOGO</p>
                    <h2>Recompensas Disponibles</h2>
                  </div>
                  <button className="secondary-button" onClick={handleAddReward}>+ Nueva Recompensa</button>
                </div>

                {rewards.length === 0 ? (
                  <p style={{ color: "var(--text-muted)" }}>No hay recompensas creadas aún.</p>
                ) : (
                  <div className="task-list">
                    {rewards.map((reward) => (
                      <div key={reward.id} className={`task-card ${reward.claimed && reward.approved ? "completed" : ""}`}>
                        <div className="task-information">
                          <strong>{reward.title}</strong>
                          <span>{reward.description || "Sin descripción"}</span>
                        </div>

                        <div className="task-points" style={{ marginRight: "12px" }}>
                          {reward.cost} pts
                        </div>

                        <div style={{ display: "flex", gap: "4px", marginRight: "8px" }}>
                          <button className="secondary-button" style={{ padding: "4px 8px", fontSize: "11px" }} onClick={() => handleEditReward(reward)} title="Editar">
                            ✎
                          </button>
                          <button className="secondary-button" style={{ padding: "4px 8px", fontSize: "11px", color: "var(--text-muted)" }} onClick={() => handleDeleteReward(reward.id)} title="Eliminar">
                            ✕
                          </button>
                        </div>

                        {!reward.claimed ? (
                          <button 
                            className="secondary-button"
                            onClick={() => requestClaimReward(reward)}
                            style={{ background: "var(--accent-primary)", color: "#ffffff", borderColor: "var(--accent-primary)" }}
                          >
                            Solicitar
                          </button>
                        ) : reward.approved ? (
                          <span style={{ color: "var(--accent-text)", fontSize: "12px", fontWeight: "bold" }}>Canjeada</span>
                        ) : currentRole === "Dominante" ? (
                          <div style={{ display: "flex", gap: "4px" }}>
                            <button 
                              className="secondary-button"
                              onClick={() => approveReward(reward)}
                              style={{ background: "var(--accent-primary)", color: "#ffffff", fontWeight: "bold", fontSize: "11px" }}
                            >
                              Aprobar
                            </button>
                            <button 
                              className="secondary-button"
                              onClick={() => rejectReward(reward)}
                              style={{ fontSize: "11px" }}
                            >
                              Rechazar
                            </button>
                          </div>
                        ) : (
                          <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>Pendiente</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : activeTab === "habits" ? (
              <>
                <div className="panel-header habits-header">
                  <div><p className="eyebrow">RITMO Y CONSTANCIA</p><h2>{isManagingHabits ? "Gestionar hábitos" : "Hábitos"}</h2><p className="habits-intro">{isManagingHabits ? "Ordena, filtra y administra sin recargar tu vista diaria." : "Prácticas recurrentes, progreso y continuidad."}</p></div>
                  <div className="habits-header-actions"><button className="secondary-button" onClick={() => { setIsManagingHabits(v => !v); setOpenActionMenu(null); }}>{isManagingHabits ? "← Volver" : "Gestionar"}</button>{!isManagingHabits && <button className="secondary-button" onClick={handleAddHabit}>+ Nuevo hábito</button>}</div>
                </div>
                {isManagingHabits && <div className="habit-manage-bar"><label><span>Ordenar</span><select value={habitSort} onChange={(e) => setHabitSort(e.target.value as "custom" | "az" | "points")}><option value="custom">Orden personalizado</option><option value="az">A–Z</option><option value="points">Más puntuación</option></select></label><label className="habit-toggle"><input type="checkbox" checked={showPausedHabits} onChange={(e) => setShowPausedHabits(e.target.checked)} /><span>Mostrar pausados</span></label><span className="habit-manage-hint">{habitSort === "custom" ? "Arrastra ⋮⋮ para reordenar" : "Selecciona Orden personalizado para arrastrar"}</span></div>}
                {(() => {
                  const visibleHabits = orderedHabits.filter(h => showPausedHabits || !h.paused);
                  const shownHabits = habitSort === "az" ? [...visibleHabits].sort((a,b) => getHabitDisplay(a).title.localeCompare(getHabitDisplay(b).title, "es")) : habitSort === "points" ? [...visibleHabits].sort((a,b) => b.points-a.points) : visibleHabits;
                  if (!shownHabits.length) return <p style={{color:"var(--text-muted)"}}>{habits.length ? "No hay hábitos visibles con este filtro." : "No hay hábitos configurados aún."}</p>;
                  return <div className={`task-list habit-list ${isManagingHabits ? "is-managing" : ""}`}>{shownHabits.map(habit => {
                    const isDoneToday=habit.lastCompletedDate===todayStr; const isExpanded=!!expandedHabits[habit.id]; const display=getHabitDisplay(habit); const canDrag=isManagingHabits&&habitSort==="custom";
                    return <div key={habit.id} className={`task-card habit-card ${isDoneToday?"completed":""} ${habit.paused?"paused":""}`} onDragOver={e=>canDrag&&e.preventDefault()} onDrop={()=>canDrag&&dropHabitOn(habit)}>
                      {isManagingHabits && <span className={`habit-drag ${canDrag?"active":""}`} draggable={canDrag} onDragStart={()=>canDrag&&setDraggedHabitId(habit.id)} onDragEnd={()=>setDraggedHabitId(null)} title={canDrag?"Arrastrar para reorganizar":"Orden personalizado desactivado"}>⋮⋮</span>}
                      {!isManagingHabits && <button className="check-button" disabled={habit.paused} onClick={()=>toggleHabitToday(habit)} title={habit.paused?"Hábito pausado":isDoneToday?"Completado hoy":"Marcar como completado hoy"}>{isDoneToday?"✓":""}</button>}
                      <div className="task-information habit-information"><div className="habit-title-line"><strong>{display.title}</strong>{habit.paused&&<span className="habit-status">Pausado</span>}</div><span>{display.subtitle}</span>
                        {isExpanded&&<div className="habit-detail"><div><span className="habit-detail-label">{display.heading}</span>{display.body&&<p>{display.body}</p>}</div><div className="habit-detail-grid"><div><small>Frecuencia</small><strong>{habit.frequency}</strong></div><div><small>Racha</small><strong>{habit.streak} días 🔥</strong></div><div><small>Valor</small><strong>+{habit.points} pts</strong></div><div><small>Asignado a</small><strong>{getMemberLabel(habit.assignedTo)}</strong></div></div><p className="habit-detail-state">{habit.paused?"Pausado temporalmente.":isDoneToday?"Completado hoy.":"Pendiente de completar hoy."}</p></div>}
                      </div>
                      <div className="habit-card-tail"><div className="task-points">+{habit.points}</div><button className="habit-icon-button" onClick={()=>toggleHabitExpanded(habit.id)} title={isExpanded?"Ocultar detalle":"Ver detalle"} aria-expanded={isExpanded}><span className={isExpanded?"chevron open":"chevron"}>⌄</span></button><div className="habit-menu-wrap"><button className="habit-icon-button habit-more" onClick={()=>setOpenActionMenu(openActionMenu===`habit-${habit.id}`?null:`habit-${habit.id}`)} aria-expanded={openActionMenu===`habit-${habit.id}`}>···</button>{openActionMenu===`habit-${habit.id}`&&<div className="habit-action-menu"><button onClick={()=>{setOpenActionMenu(null);toggleHabitExpanded(habit.id)}}>Ver detalle</button><button onClick={()=>{setOpenActionMenu(null);handleEditHabit(habit)}}>Editar</button><button onClick={()=>toggleHabitPaused(habit)}>{habit.paused?"Reactivar":"Pausar"}</button><div className="habit-menu-divider"/><button className="danger" onClick={()=>{setOpenActionMenu(null);handleDeleteHabit(habit.id)}}>Eliminar</button></div>}</div></div>
                    </div>
                  })}</div>;
                })()}
              </>
            ) : (
              <>
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">PLAN DE HOY</p>
                    <h2>Tareas y Subtareas</h2>
                  </div>
                  <button className="secondary-button" onClick={() => handleAddTask(null)}>+ Nueva tarea</button>
                </div>

                {loading ? (
                  <p style={{ color: "var(--text-muted)" }}>Cargando datos desde Firebase...</p>
                ) : rootTasks.length === 0 ? (
                  <p style={{ color: "var(--text-muted)" }}>No hay tareas guardadas aún.</p>
                ) : (
                  <div className="task-list">
                    {rootTasks.map((task) => {
                      const subtasks = getSubtasks(task.id);
                      const isDomAssigned = task.createdByRole === "Dominante";

                      return (
                        <div
  key={task.id}
  style={{
    marginBottom: "22px",
    position: "relative",
    zIndex: openActionMenu === `task-${task.id}` ? 100 : 1,
  }}
>
                          {/* TAREA PRINCIPAL */}
                          <div
                            className={`task-card ${task.completed ? "completed" : ""}`}
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={() => dropTaskOn(task)}
                            style={{
                              position: "relative",
                              padding: "14px 14px 14px 40px",
                              borderRadius: "10px",
                              outline: draggedTaskId === task.id ? "1px dashed var(--accent-primary)" : "none",
                            }}
                          >
<span
                              draggable
                              onDragStart={() => setDraggedTaskId(task.id)}
                              onDragEnd={() => setDraggedTaskId(null)}
                              title="Arrastrar para reorganizar"
                              aria-label={`Reorganizar ${task.title}`}
                              role="button"
                              tabIndex={0}
                              style={{
                                position: "absolute",
                                left: "7px",
                                top: "50%",
                                transform: "translateY(-50%)",
                                width: "22px",
                                height: "44px",
                                display: "grid",
                                gridTemplateColumns: "repeat(2, 3px)",
                                gridTemplateRows: "repeat(3, 3px)",
                                gap: "3px",
                                alignContent: "center",
                                justifyContent: "center",
                                cursor: "grab",
                                opacity: 0.28,
                                touchAction: "none",
                                userSelect: "none",
                                borderRadius: "8px",
                              }}
                            >
                              {Array.from({ length: 6 }).map((_, dotIndex) => (
                                <span
                                  key={dotIndex}
                                  aria-hidden="true"
                                  style={{
                                    width: "3px",
                                    height: "3px",
                                    borderRadius: "50%",
                                    background: "currentColor",
                                  }}
                                />
                              ))}
                            </span>
                            <button
                              className="check-button"
                              onClick={() => toggleTask(task.id, task.completed)}
                            >
                              {task.completed ? "✓" : ""}
                            </button>

                            <div className="task-information">
                              <div
                                style={{
                                  display: "flex",
                                  gap: "8px",
                                  alignItems: "center",
                                  flexWrap: "wrap",
                                }}
                              >
                                <strong
                                  style={{
                                    fontSize: "15px",
                                    fontWeight: 700,
                                  }}
                                >
                                  {task.title}
                                </strong>

                                {isDomAssigned && (
                                  <span
                                    style={{
                                      fontSize: "10px",
                                      background: "var(--accent-bg)",
                                      color: "var(--accent-text)",
                                      border: "1px solid var(--accent-primary)",
                                      padding: "2px 6px",
                                      borderRadius: "4px",
                                    }}
                                  >
                                    Dominante
                                  </span>
                                )}
                              </div>

                              {task.description && (
                                <span
                                  style={{
                                    display: "block",
                                    marginTop: "6px",
                                    lineHeight: "1.5",
                                  }}
                                >
                                  {task.description}
                                </span>
                              )}

                              {task.evidenceUrl && (
                                <div style={{ marginTop: "8px" }}>
                                  <a
                                    href={task.evidenceUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{
                                      fontSize: "11px",
                                      color: "var(--accent-text)",
                                      textDecoration: "underline",
                                    }}
                                  >
                                    Ver Evidencia Fotográfica ↗
                                  </a>
                                  <div>
                                    <img
                                      src={task.evidenceUrl}
                                      alt="Evidencia"
                                      className="evidence-preview"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>

<div
  style={{
    display: "flex",
    alignItems: "center",
    gap: "6px",
    flexWrap: "nowrap",
    flexShrink: 0,
  }}
>
  

  <div
 style={{
  display: "flex",
  gap: "6px",
  flexWrap: "nowrap",
  alignItems: "center",
  justifyContent: "flex-end",
  flexShrink: 0,
  marginLeft: "auto",
}}
>
 <div className="task-points" style={{ marginRight: "0" }}>
    +{task.points}
  </div>        
                       {subtasks.length > 0 && (
                                <button
                                  className="secondary-button"
                                  style={{ padding: "4px 9px", fontSize: "12px", minWidth: "34px" }}
                                  onClick={() => toggleTaskExpanded(task.id)}
                                  title={expandedTasks[task.id] ? "Ocultar subtareas" : "Mostrar subtareas"}
                                  aria-label={expandedTasks[task.id] ? "Ocultar subtareas" : "Mostrar subtareas"}
                                >
                                  <svg
                                    width="20"
                                    height="20"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                    style={{
                                      display: "block",
                                      transition: "transform 180ms ease",
                                      transform: expandedTasks[task.id]
                                        ? "rotate(180deg)"
                                        : "rotate(0deg)",
                                    }}
                                  >
                                    <polyline points="6 9 12 15 18 9" />
                                  </svg>
                                </button>
                              )}

                              <div
  style={{
    position: "relative",
    flexShrink: 0,
  }}
>
                                <button
                                  className="secondary-button"
                                  style={{
                                    width: "34px",
                                    height: "34px",
                                    minWidth: "34px",
                                    padding: 0,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: "17px",
                                    letterSpacing: "1px",
                                  }}
                                  onClick={() =>
                                    setOpenActionMenu(
                                      openActionMenu === `task-${task.id}` ? null : `task-${task.id}`
                                    )
                                  }
                                  title="Más acciones"
                                  aria-label="Más acciones de la tarea"
                                  aria-expanded={openActionMenu === `task-${task.id}`}
                                >
                                  ···
                                </button>

                                {openActionMenu === `task-${task.id}` && (
                               <div
  style={{
    position: "relative",
    right: "auto",
    top: "auto",
    zIndex: 1,
    width: "170px",
    marginTop: "6px",
    marginLeft: "auto",
    padding: "6px",
    border: "1px solid var(--border-color)",
    borderRadius: "10px",
    background: "var(--bg-card)",
    boxShadow: "0 12px 28px rgba(0,0,0,0.14)",
  }}
>
                                    <button
                                      className="nav-item"
                                      style={{ width: "100%", padding: "8px 10px" }}
                                      onClick={() => {
                                        setOpenActionMenu(null);
                                        handleAddTask(task.id);
                                      }}
                                    >
                                      Añadir subtarea
                                    </button>
                                    <button
                                      className="nav-item"
                                      style={{ width: "100%", padding: "8px 10px" }}
                                      onClick={() => {
                                        setOpenActionMenu(null);
                                        handleEditTask(task);
                                      }}
                                    >
                                      Editar
                                    </button>
                                    <div style={{ height: "1px", background: "var(--border-color)", margin: "4px 6px" }} />
                                    <button
                                      className="nav-item"
                                      style={{ width: "100%", padding: "8px 10px", color: "var(--text-muted)" }}
                                      onClick={() => {
                                        setOpenActionMenu(null);
                                        handleDeleteTask(task);
                                      }}
                                    >
                                      Eliminar
                                    </button>
                                  </div>
                                )}
                              </div>
                              </div>
                            </div>
                          </div>

                          {/* BLOQUE DE SUBTAREAS */}
                          {subtasks.length > 0 && expandedTasks[task.id] && (
                            <div
                              style={{
                                marginLeft: "30px",
                                marginTop: "10px",
                                paddingLeft: "16px",
                                borderLeft: "2px solid var(--accent-primary)",
                                display: "flex",
                                flexDirection: "column",
                                gap: "8px",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: "10px",
                                  fontWeight: 700,
                                  letterSpacing: "0.08em",
                                  color: "var(--text-muted)",
                                  textTransform: "uppercase",
                                  marginBottom: "2px",
                                }}
                              >
                                SUBTAREAS
                              </div>

                              {subtasks.map((subtask, subtaskIndex) => (
                                <div
                                  key={subtask.id}
                                  className={`task-card ${subtask.completed ? "completed" : ""}`}
                                  onDragOver={(event) => event.preventDefault()}
                                  onDrop={() => dropTaskOn(subtask)}
                                  style={{
                                    position: "relative",
                                    zIndex: openActionMenu === `subtask-${subtask.id}` ? 100 : 1,
                                    background: "var(--bg-main)",
                                    padding: "11px 12px 11px 38px",
                                    borderRadius: "8px",
                                    opacity: subtask.completed ? 0.65 : 1,
                                    outline: draggedTaskId === subtask.id ? "1px dashed var(--accent-primary)" : "none",
                                  }}
                                >
<span
                                    draggable
                                    onDragStart={() => setDraggedTaskId(subtask.id)}
                                    onDragEnd={() => setDraggedTaskId(null)}
                                    title="Arrastrar para reorganizar"
                                    aria-label={`Reorganizar ${subtask.title}`}
                                    role="button"
                                    tabIndex={0}
                                    style={{
                                      position: "absolute",
                                      left: "5px",
                                      top: "50%",
                                      transform: "translateY(-50%)",
                                      width: "22px",
                                      height: "44px",
                                      display: "grid",
                                      gridTemplateColumns: "repeat(2, 3px)",
                                      gridTemplateRows: "repeat(3, 3px)",
                                      gap: "3px",
                                      alignContent: "center",
                                      justifyContent: "center",
                                      cursor: "grab",
                                      opacity: 0.28,
                                      touchAction: "none",
                                      userSelect: "none",
                                      borderRadius: "8px",
                                    }}
                                  >
                                    {Array.from({ length: 6 }).map((_, dotIndex) => (
                                      <span
                                        key={dotIndex}
                                        aria-hidden="true"
                                        style={{
                                          width: "3px",
                                          height: "3px",
                                          borderRadius: "50%",
                                          background: "currentColor",
                                        }}
                                      />
                                    ))}
                                  </span>
                                  <button
                                    className="check-button"
                                    onClick={() => toggleTask(subtask.id, subtask.completed)}
                                  >
                                    {subtask.completed ? "✓" : ""}
                                  </button>

                                  <div className="task-information">
                                    <strong
                                      style={{
                                        display: "block",
                                        fontSize: "14px",
                                        fontWeight: 600,
                                        fontStyle: "italic",
                                        lineHeight: "1.35",
                                      }}
                                    >
                                      ↳ {subtask.title}
                                    </strong>

                                    {subtask.description && (
                                      <span
                                        style={{
                                          display: "block",
                                          marginTop: "5px",
                                          paddingLeft: "20px",
                                          fontSize: "12px",
                                          color: "var(--text-sub)",
                                          fontStyle: "italic",
                                          lineHeight: "1.5",
                                        }}
                                      >
                                        {subtask.description}
                                      </span>
                                    )}

                                    {subtask.evidenceUrl && (
                                      <div style={{ marginTop: "7px", paddingLeft: "20px" }}>
                                        <a
                                          href={subtask.evidenceUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          style={{
                                            fontSize: "11px",
                                            color: "var(--accent-text)",
                                            textDecoration: "underline",
                                          }}
                                        >
                                          Ver Evidencia Fotográfica ↗
                                        </a>
                                        <div>
                                          <img
                                            src={subtask.evidenceUrl}
                                            alt="Evidencia"
                                            className="evidence-preview"
                                          />
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  <div className="task-points" style={{ marginRight: "8px" }}>
                                    +{subtask.points}
                                  </div>

                                  <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                                    <div style={{ position: "relative" }}>
                                      <button
                                        className="secondary-button"
                                        style={{ width: "34px", height: "32px", minWidth: "34px", padding: 0, fontSize: "16px" }}
                                        onClick={() =>
                                          setOpenActionMenu(
                                            openActionMenu === `subtask-${subtask.id}` ? null : `subtask-${subtask.id}`
                                          )
                                        }
                                        title="Más acciones"
                                        aria-label="Más acciones de la subtarea"
                                        aria-expanded={openActionMenu === `subtask-${subtask.id}`}
                                      >
                                        ···
                                      </button>
                                      {openActionMenu === `subtask-${subtask.id}` && (
                                        <div style={{
                                          position: "absolute",
                                         left: "50%",
transform: "translateX(-50%)",
                                          top: subtaskIndex === subtasks.length - 1 ? "auto" : "calc(100% + 6px)",
bottom: subtaskIndex === subtasks.length - 1 ? "calc(100% + 6px)" : "auto",
                                          zIndex: 50,
                                          minWidth: "145px",
                                          padding: "6px",
                                          border: "1px solid var(--border-color)",
                                          borderRadius: "10px",
                                          background: "var(--bg-card)",
                                          boxShadow: "0 12px 28px rgba(0,0,0,0.14)",
                                        }}>
                                          <button className="nav-item" style={{ width: "100%", padding: "8px 10px" }}
                                            onClick={() => { setOpenActionMenu(null); handleEditTask(subtask); }}>
                                            Editar
                                          </button>
                                          <div style={{ height: "1px", background: "var(--border-color)", margin: "4px 6px" }} />
                                          <button className="nav-item" style={{ width: "100%", padding: "8px 10px", color: "var(--text-muted)" }}
                                            onClick={() => { setOpenActionMenu(null); handleDeleteTask(subtask); }}>
                                            Eliminar
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">GAMIFICACIÓN</p>
                <h2>Progreso</h2>
              </div>
            </div>

            <p style={{ color: "var(--text-sub)", fontSize: "13px", marginTop: "4px" }}>
              Acumula puntos completando tareas y hábitos para avanzar de rango y desbloquear insignias.
            </p>

            {/* PROGRESO DE PUNTOS */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                marginTop: "24px",
                marginBottom: "28px",
              }}
            >
              <div
                style={{
                  width: "170px",
                  height: "170px",
                  borderRadius: "50%",
                  background: `conic-gradient(
                    var(--accent-primary) 0deg,
                    var(--accent-primary) 250deg,
                    var(--bg-main) 250deg,
                    var(--bg-main) 360deg
                  )`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    width: "132px",
                    height: "132px",
                    borderRadius: "50%",
                    background: "var(--bg-panel)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                  }}
                >
                  <strong style={{ fontSize: "28px", lineHeight: "1" }}>
                    {totalEarnedHistorical}
                  </strong>
                  <span style={{ fontSize: "12px", color: "var(--text-sub)", marginTop: "6px" }}>
                    puntos
                  </span>
                </div>
              </div>

            </div>

            {/* INSIGNIAS */}
            <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "20px" }}>
              <h3 style={{ margin: "0 0 12px 0" }}>Insignias</h3>
              <p style={{ color: "var(--text-sub)", fontSize: "12px", marginBottom: "16px" }}>
                Desbloquea insignias automáticas cumpliendo objetivos.
              </p>

              <div className="badges-container">
                {badgesList.map((badge) => (
                  <div key={badge.id} className={`badge-card ${badge.unlocked ? "unlocked" : "locked"}`}>
                    <span className="badge-icon">{badge.icon}</span>
                    <div>
                      <h4 className="badge-title">{badge.title}</h4>
                      <p className="badge-desc">{badge.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* INFORMACIÓN DE PROGRESO */}
            <div style={{ marginTop: "24px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <div className="mini-stat">
                <span>Puntos Acumulados Totales</span>
                <strong>{totalEarnedHistorical} pts</strong>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;