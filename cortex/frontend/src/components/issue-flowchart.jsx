import { useState, useCallback, useEffect, useRef } from "react"
import {
    ReactFlow,
    ReactFlowProvider,
    Background,
    Controls,
    MiniMap,
    useNodesState,
    useEdgesState,
    useReactFlow,
    Handle,
    Position,
    addEdge,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import dagre from "dagre"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { motion, AnimatePresence } from "framer-motion"
import { FADE_IN } from "@/lib/animations"
import { toast } from "sonner"
import { CortexLoader } from "./cortex-loader"
import { useAuth } from "@/context/AuthContext"
import { ChevronDown } from "lucide-react"

// Syntax highlighting imports
import Editor from "react-simple-code-editor"
import Prism from "prismjs"
import "prismjs/themes/prism-twilight.css" // A dark theme that fits CORTEX 
import "prismjs/components/prism-python"
import "prismjs/components/prism-c"
import "prismjs/components/prism-cpp"
import "prismjs/components/prism-java"
import "prismjs/components/prism-sql"
import "prismjs/components/prism-javascript"
import "prismjs/components/prism-typescript"

// ─── Custom Node Configurations ────────────────────────────────────

const NODE_COLORS = {
    pending: { bg: "rgba(142, 142, 147, 0.1)", border: "#8e8e93", text: "#8e8e93" },
    yellow: { bg: "rgba(255, 204, 0, 0.15)", border: "#ffcc00", text: "#e6b800" },
    blue: { bg: "rgba(0, 191, 255, 0.15)", border: "#00bfff", text: "#00bfff" },
    green: { bg: "rgba(52, 199, 89, 0.15)", border: "#34c759", text: "#34c759" },
    red: { bg: "rgba(255, 59, 48, 0.15)", border: "#ff3b30", text: "#ff3b30" },
}

/**
 * Centralized RBAC logic for nodes.
 * @returns { canEdit: bool, canTag: bool, canDelete: bool, canAddNode: bool }
 */
const getNodePermissions = (nodeData, user) => {
    if (!user) return { canEdit: false, canTag: false, canDelete: false, canAddNode: false }

    const isSenior = user.role?.toLowerCase() === "senior"
    const isAuthor = nodeData?.author === user.emp_id
    const isPending = nodeData?.tag === "pending"
    const isBlue = nodeData?.tag === "blue"

    return {
        isSenior,
        isAuthor,
        isPending,
        canEdit: isSenior || (isAuthor && isPending),
        canTag: isSenior,
        canDelete: isSenior || isAuthor, // AUTHORSHIP check is handled in handleDelete with 30m rule
        canAddNode: !isBlue || isSenior // Seniors can always add; Blue blocks others
    }
}

const PlusButton = ({ position, onClick }) => {
    let posClass = ""
    if (position === Position.Top) posClass = "-top-2 left-1/2 -translate-x-1/2"
    if (position === Position.Bottom) posClass = "-bottom-2 left-1/2 -translate-x-1/2"
    if (position === Position.Left) posClass = "-left-2 top-1/2 -translate-y-1/2"
    if (position === Position.Right) posClass = "-right-2 top-1/2 -translate-y-1/2"

    return (
        <button
            onClick={(e) => {
                e.stopPropagation()
                onClick(e)
            }}
            className={`absolute ${posClass} bg-[var(--bg-panel)] border border-subtle-custom w-4 h-4 rounded-full flex items-center justify-center hover:border-[var(--accent-blue-bright)] hover:text-[var(--accent-blue-bright)] transition-colors z-[100] text-secondary-custom cursor-pointer shadow-sm`}
        >
            <span className="text-[12px] leading-none mb-[1px]">+</span>
        </button>
    )
}

const CustomNode = ({ data, id }) => {
    const { label, tag, author, date, type, onAddNode, onTagClick, senior_comment } = data
    const { user } = useAuth()
    const styling = NODE_COLORS[tag] || NODE_COLORS.pending

    const permissions = getNodePermissions(data, user)
    const isSenior = permissions.isSenior

    const isRoot = type === "new"
    const isEnd = tag === "red"

    // Truncate label to 15 chars for compact node display
    const displayLabel = label?.length > 15 ? label.substring(0, 15) + "..." : label

    return (
        <div className="node-wrapper relative cursor-pointer min-w-[200px] max-w-[280px]">
            {/* ── Drag Handle ── Corner-shape scoop circle */}
            <div
                className="drag-handle cortex-node-drag"
                style={{ backgroundColor: styling.border }}
                title="Drag to move"
            >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="2" cy="2" r="1.2" fill="currentColor" opacity="0.6" />
                    <circle cx="5" cy="2" r="1.2" fill="currentColor" opacity="0.6" />
                    <circle cx="8" cy="2" r="1.2" fill="currentColor" opacity="0.6" />
                    <circle cx="2" cy="5" r="1.2" fill="currentColor" opacity="0.6" />
                    <circle cx="5" cy="5" r="1.2" fill="currentColor" opacity="0.6" />
                    <circle cx="8" cy="5" r="1.2" fill="currentColor" opacity="0.6" />
                    <circle cx="2" cy="8" r="1.2" fill="currentColor" opacity="0.6" />
                    <circle cx="5" cy="8" r="1.2" fill="currentColor" opacity="0.6" />
                    <circle cx="8" cy="8" r="1.2" fill="currentColor" opacity="0.6" />
                </svg>
            </div>

            {/* Centered hidden handles for precision routing. */}
            <Handle id="top-target" type="target" position={Position.Top} className="opacity-0 w-4 h-4 hover:opacity-100 bg-[var(--accent-blue-bright)] border-none -mt-2 transition-opacity z-10" style={{ left: '50%' }} />
            <Handle id="top-source" type="source" position={Position.Top} className="opacity-0 w-4 h-4 hover:opacity-100 bg-[var(--semantic-success)] border-none -mt-2 transition-opacity z-10" style={{ left: '50%' }} />

            <Handle id="bottom-target" type="target" position={Position.Bottom} className="opacity-0 w-4 h-4 hover:opacity-100 bg-[var(--accent-blue-bright)] border-none -mb-2 transition-opacity z-10" style={{ left: '50%' }} />
            <Handle id="bottom-source" type="source" position={Position.Bottom} className="opacity-0 w-4 h-4 hover:opacity-100 bg-[var(--semantic-success)] border-none -mb-2 transition-opacity z-10" style={{ left: '50%' }} />

            <Handle id="left-target" type="target" position={Position.Left} className="opacity-0 w-4 h-4 hover:opacity-100 bg-[var(--accent-blue-bright)] border-none -ml-2 transition-opacity z-10" style={{ top: '50%' }} />
            <Handle id="left-source" type="source" position={Position.Left} className="opacity-0 w-4 h-4 hover:opacity-100 bg-[var(--semantic-success)] border-none -ml-2 transition-opacity z-10" style={{ top: '50%' }} />

            <Handle id="right-target" type="target" position={Position.Right} className="opacity-0 w-4 h-4 hover:opacity-100 bg-[var(--accent-blue-bright)] border-none -mr-2 transition-opacity z-10" style={{ top: '50%' }} />
            <Handle id="right-source" type="source" position={Position.Right} className="opacity-0 w-4 h-4 hover:opacity-100 bg-[var(--semantic-success)] border-none -mr-2 transition-opacity z-10" style={{ top: '50%' }} />

            {!isRoot && <PlusButton position={Position.Top} onClick={() => onAddNode?.(id, 'top')} />}

            {!isRoot && !isEnd && (
                <>
                    <PlusButton position={Position.Left} onClick={() => onAddNode?.(id, 'left')} />
                    <PlusButton position={Position.Right} onClick={() => onAddNode?.(id, 'right')} />
                </>
            )}

            {/* Visible Node Box - This is the part that clips */}
            <div
                className="cortex-node rounded-xl border backdrop-blur-md px-4 py-3 shadow-lg relative overflow-hidden h-full"
                style={{
                    backgroundColor: styling.bg,
                    borderColor: styling.border,
                    boxShadow: `0 4px 20px ${styling.bg}`,
                    '--node-accent': styling.border,
                }}
            >
                <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center min-h-[24px]">
                        <div className="text-xs font-mono font-bold uppercase tracking-widest leading-snug break-words pr-2 text-primary-custom" style={{ wordBreak: 'break-word' }}>
                            {displayLabel}
                        </div>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (isSenior) onTagClick?.(id, tag);
                            }}
                            className={`flex-shrink-0 text-[9px] px-1.5 py-0.5 rounded font-mono font-bold uppercase border transition-all ${isSenior ? 'cursor-pointer hover:scale-105 active:scale-95' : 'cursor-default'}`}
                            style={{ color: styling.text, borderColor: styling.text, backgroundColor: styling.bg }}
                            title={isSenior ? "Change status" : "Status (Senior only)"}
                        >
                            {tag}
                        </button>
                    </div>

                    {tag === 'blue' && senior_comment && (
                        <div className="bg-white/10 border-l-2 border-[var(--accent-blue-bright)] p-2 rounded-md shadow-inner mb-1">
                            <div className="text-[8px] text-[var(--accent-blue-bright)] font-bold uppercase tracking-tighter mb-1 select-none">Senior Note</div>
                            <div className="text-[9px] text-primary-custom font-mono leading-tight">"{senior_comment}"</div>
                        </div>
                    )}

                    <div className="flex justify-between items-center text-[10px] font-mono border-t border-subtle-custom pt-2 mt-1">
                        <span className="text-secondary-custom/60 uppercase tracking-widest">{date || "UNKNOWN DATE"}</span>
                        <span className="text-primary-custom/80 uppercase tracking-widest truncate max-w-[100px] text-right">{author}</span>
                    </div>
                </div>
            </div>

            {/* Bottom button is blocked if node is Blue and has no validated side branch */}
            {permissions.canAddNode && !isEnd && (
                <PlusButton position={Position.Bottom} onClick={() => onAddNode?.(id, Position.Bottom)} />
            )}
        </div>
    )
}

const nodeTypes = {
    custom: CustomNode,
}

// ─── Languages Dropdown Component ──────────────────────────────────
const SUPPORTED_LANGUAGES = ["Python", "C++", "JAVA", "SQL", "Javascript", "Typescript", "Text"];

// Helper to map UI language strings to PrismJS language definitions
const getPrismLanguage = (langStr) => {
    switch (langStr?.toLowerCase()) {
        case "python": return Prism.languages.python;
        case "c++": return Prism.languages.cpp;
        case "java": return Prism.languages.java;
        case "sql": return Prism.languages.sql;
        case "javascript": return Prism.languages.javascript;
        case "typescript": return Prism.languages.typescript;
        default: return Prism.languages.javascript; // fallback
    }
}

const LanguageDropdown = ({ value, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-1.5 bg-black/40 border border-subtle-custom rounded-md text-xs font-mono text-secondary-custom hover:text-white hover:border-white/20 transition-all"
            >
                {value || "Select Lang"}
                <ChevronDown className="w-3 h-3" />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="absolute top-full mt-1 right-0 bg-surface-custom border border-subtle-custom rounded-md shadow-xl overflow-hidden z-[200] min-w-[120px]"
                    >
                        {SUPPORTED_LANGUAGES.map(lang => (
                            <button
                                key={lang}
                                type="button"
                                onClick={() => { onChange(lang); setIsOpen(false); }}
                                className="w-full text-left px-4 py-2 text-xs font-mono text-secondary-custom hover:bg-white/10 hover:text-white transition-colors"
                            >
                                {lang}
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ─── Dagre Layout Generator ────────────────────────────────────────

const getLayoutedElements = (nodes, edges) => {
    const dagreGraph = new dagre.graphlib.Graph()
    dagreGraph.setDefaultEdgeLabel(() => ({}))

    // Graph config: top to bottom, with some spacing
    dagreGraph.setGraph({ rankdir: "TB", nodesep: 100, ranksep: 100 })

    nodes.forEach((node) => {
        // Approximate dimensions of our custom node
        dagreGraph.setNode(node.id, { width: 260, height: 120 })
    })

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target)
    })

    dagre.layout(dagreGraph)

    const layoutedNodes = nodes.map((node) => {
        const nodeWithPosition = dagreGraph.node(node.id)

        const parsedX = parseFloat(node.data?.layout_x)
        const parsedY = parseFloat(node.data?.layout_y)

        return {
            ...node,
            position: {
                x: !isNaN(parsedX) ? parsedX : (nodeWithPosition.x - 130),
                y: !isNaN(parsedY) ? parsedY : (nodeWithPosition.y - 60),
            },
        }
    })

    // ─── Branch Inheritance Topological Sort ───
    const adj = {};
    edges.forEach(e => {
        if (!adj[e.source]) adj[e.source] = [];
        adj[e.source].push(e);
    });

    const mainNodes = new Set();
    const rootNodes = nodes.filter(n => n.type === 'new' || n.type === 'merged_truth').map(n => n.id);
    rootNodes.forEach(r => mainNodes.add(r));
    const queue = [...rootNodes];

    // Fallback if graph is completely detached
    if (queue.length === 0 && nodes.length > 0) {
        queue.push(nodes[0].id)
        mainNodes.add(nodes[0].id)
    }

    while (queue.length > 0) {
        const curr = queue.shift();
        const currIsMain = mainNodes.has(curr);

        const childrenEdges = adj[curr] || [];
        childrenEdges.forEach(edge => {
            const sourceNode = layoutedNodes.find(n => n.id === edge.source);
            const targetNode = layoutedNodes.find(n => n.id === edge.target);

            if (sourceNode && targetNode) {
                const dx = targetNode.position.x - sourceNode.position.x;
                const dy = targetNode.position.y - sourceNode.position.y;
                const isHorizontal = Math.abs(dx) > Math.abs(dy);

                // Target is part of the main branch ONLY IF parent is main branch AND connection is vertical
                if (currIsMain && !isHorizontal) {
                    mainNodes.add(edge.target);
                }
            }
            queue.push(edge.target);
        });
    }

    const layoutedEdges = edges.map((edge) => {
        const sourceNode = layoutedNodes.find(n => n.id === edge.source);
        const targetNode = layoutedNodes.find(n => n.id === edge.target);

        if (!sourceNode || !targetNode) return edge;

        const dx = targetNode.position.x - sourceNode.position.x;
        const dy = targetNode.position.y - sourceNode.position.y;

        let sourceHandle = 'bottom-source';
        let targetHandle = 'top-target';

        // Target is Above or Below physically?
        const isHorizontal = Math.abs(dx) > Math.abs(dy);

        // Is this edge connecting a main node to another main node vertically?
        const sourceIsMain = mainNodes.has(edge.source);
        const targetIsMain = mainNodes.has(edge.target);
        const isMainBranch = sourceIsMain && targetIsMain && !isHorizontal;

        if (isHorizontal) {
            if (dx > 0) {
                // Target is to the Right
                sourceHandle = 'right-source';
                targetHandle = 'left-target';
            } else {
                // Target is to the Left
                sourceHandle = 'left-source';
                targetHandle = 'right-target';
            }
        } else {
            // Target is Above or Below
            if (dy < 0) {
                // Reverse edge (Target is Above)
                sourceHandle = 'top-source';
                targetHandle = 'bottom-target';
            }
        }

        return {
            ...edge,
            type: 'smoothstep',
            sourceHandle,
            targetHandle,
            style: {
                stroke: isMainBranch ? 'var(--accent-blue-bright)' : 'var(--text-secondary)',
                strokeWidth: isMainBranch ? 3 : 2,
                strokeDasharray: isMainBranch ? 'none' : '5 5'
            }
        }
    })

    return { nodes: layoutedNodes, edges: layoutedEdges }
}

// ─── Main Component ────────────────────────────────────────────────

export default function IssueFlowchart({ issueId }) {
    return (
        <ReactFlowProvider>
            <IssueFlowchartInner issueId={issueId} />
        </ReactFlowProvider>
    )
}

function IssueFlowchartInner({ issueId }) {
    const { user } = useAuth()
    const { getNode, getNodes } = useReactFlow()
    const [nodes, setNodes, onNodesChange] = useNodesState([])
    const [edges, setEdges, onEdgesChange] = useEdgesState([])
    const [isLoading, setIsLoading] = useState(true)

    const [activeTagEdit, setActiveTagEdit] = useState(null)
    const [tagConfirm, setTagConfirm] = useState(null)
    const [seniorCommentText, setSeniorCommentText] = useState("")
    const [connectConfirm, setConnectConfirm] = useState(null)
    const [confirmText, setConfirmText] = useState("")
    const [refreshKey, setRefreshKey] = useState(0)

    const [deleteConfirm, setDeleteConfirm] = useState(null)

    const [isDraggingNode, setIsDraggingNode] = useState(false)
    const [isHoveringTrash, setIsHoveringTrash] = useState(false)
    const isHoveringTrashRef = useRef(false)

    // ── Ctrl+Z Undo Stack ──
    // Each entry: { type, payload, description }
    const undoStackRef = useRef([])

    // Ctrl+Z undo handler
    const handleUndo = useCallback(async () => {
        if (undoStackRef.current.length === 0) {
            toast.info("Nothing to undo")
            return
        }

        const action = undoStackRef.current.pop()
        try {
            switch (action.type) {
                case 'UNDO_ADD_NODE':
                    await api.deleteIssueNode(action.payload.nodeId)
                    setNodes(nds => nds.filter(n => n.id !== action.payload.nodeId))
                    setEdges(eds => eds.filter(e => e.source !== action.payload.nodeId && e.target !== action.payload.nodeId))
                    toast.success("Undo: Node addition reverted")
                    setRefreshKey(prev => prev + 1)
                    break

                case 'UNDO_DELETE_NODE':
                    await api.restoreNode(action.payload)
                    toast.success("Undo: Node restored")
                    setRefreshKey(prev => prev + 1)
                    break

                case 'UNDO_TAG_CHANGE':
                    setNodes(nds => nds.map(n => n.id === action.payload.nodeId ? { ...n, data: { ...n.data, tag: action.payload.previousTag } } : n))
                    await api.tagIssueNode(action.payload.nodeId, action.payload.previousTag)
                    toast.success("Undo: Tag reverted")
                    break

                case 'UNDO_NODE_UPDATE':
                    await api.updateNodeInfo(action.payload.nodeId, {
                        issue_header: action.payload.previousHeader,
                        description: action.payload.previousDescription,
                        code_changes: action.payload.previousCode,
                        code_language: action.payload.previousLang
                    })
                    toast.success("Undo: Node info reverted")
                    setRefreshKey(prev => prev + 1)
                    break

                default:
                    toast.error("Unknown undo action")
            }
        } catch (err) {
            // Put the action back if undo failed
            undoStackRef.current.push(action)
            toast.error("Undo failed", { description: err.message })
        }
    }, [user, setNodes, setEdges])

    // Ctrl+Z keyboard listener
    useEffect(() => {
        const handler = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault()
                handleUndo()
            }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [handleUndo])

    // Node info modal state: { mode: "view" | "edit" | "create", nodeParams: {...} }
    const [activeNodeModal, setActiveNodeModal] = useState(null)
    // Modal Form State
    const [modalHeader, setModalHeader] = useState("")
    const [modalDescription, setModalDescription] = useState("")
    const [modalCode, setModalCode] = useState("")
    const [modalLang, setModalLang] = useState("Python")

    // Merge State: { originBlueNodeId, branchTrail, sourceNodeId, targetNodeId }
    const [pendingMerge, setPendingMerge] = useState(null)

    // Helper to finalize merge and connection
    const handleFinalizeMerge = useCallback(async (originNodeId, documentation = {}) => {
        if (!pendingMerge || pendingMerge.originBlueNodeId !== originNodeId) return;

        try {
            await api.mergeBlueBranch(
                pendingMerge.originBlueNodeId,
                pendingMerge.branchTrail,
                "Branch merged via trail validation after documentation.",
                user?.emp_id || "SYS",
                user?.dept_id || "SYS",
                documentation
            )
            await api.connectNode(pendingMerge.sourceNodeId, pendingMerge.targetNodeId, user?.emp_id || "SYS")
            toast.success("Branch Merged & Trail Validated")
            setPendingMerge(null)
        } catch (err) {
            console.error("Finalize merge failed:", err);
            throw new Error(`Merge finalization failed: ${err.message}`);
        }
    }, [pendingMerge, user]);

    // Handlers
    const onNodeDragStart = useCallback((event, node) => {
        setIsDraggingNode(true)
    }, [])

    const onNodeDrag = useCallback((event, node) => {
        const trashZone = document.getElementById('trash-zone')
        if (trashZone) {
            const rect = trashZone.getBoundingClientRect()
            const hovering = event.clientX >= rect.left && event.clientX <= rect.right &&
                event.clientY >= rect.top && event.clientY <= rect.bottom
            setIsHoveringTrash(hovering)
            isHoveringTrashRef.current = hovering
        }
    }, [])

    const onNodeDragStop = useCallback(async (event, node) => {
        setIsDraggingNode(false)
        const wasHoveringTrash = isHoveringTrashRef.current
        setIsHoveringTrash(false)
        isHoveringTrashRef.current = false

        if (wasHoveringTrash) {
            if (node.id.startsWith("ISS-")) {
                toast.error("Cannot delete root issues.")
                setRefreshKey(prev => prev + 1)
                return
            }

            // Permission check using centralized helper
            const nodeData = getNode(node.id)?.data
            const permissions = getNodePermissions(nodeData, user)

            if (!permissions.isSenior && nodeData?.author !== user?.emp_id) {
                toast.error("You don't have permission to perform this action")
                setRefreshKey(prev => prev + 1)
                return
            }

            // Red-node read-only: check if main branch is closed
            const allNodes = getNodes()
            const hasRedNode = allNodes.some(n => n.data?.tag === 'red')
            if (hasRedNode) {
                toast.error("Graph is closed. No modifications allowed.")
                setRefreshKey(prev => prev + 1)
                return
            }

            try {
                // Permission check using shared logic
                const nodeData = getNode(node.id)?.data

                const authorEmpId = nodeData?.author
                const isPending = nodeData?.tag === 'pending'
                const isSenior = user?.role?.toLowerCase() === 'senior'
                const isAuthor = authorEmpId === user?.emp_id

                if (!isSenior && !(isAuthor && isPending)) {
                    toast.error("You don't have permission to perform this action", {
                        description: !isAuthor ? "Only the author can delete this node." :
                            "Only pending nodes can be deleted by team members."
                    })
                    setRefreshKey(prev => prev + 1)
                    return
                }

                setDeleteConfirm({ nodeId: node.id, label: nodeData?.label })
            } catch (err) {
                toast.error("Failed to initiate deletion", { description: err.message })
                setRefreshKey(prev => prev + 1)
            }
        } else {
            // Save structural coordinates persistently!
            if (!node.id.startsWith("ISS-")) {
                try {
                    await api.updateNodePosition(node.id, node.position.x, node.position.y)
                } catch (err) {
                    console.error("Failed to persist node coordinates", err)
                }
            }
        }
    }, [user, getNode, getNodes, edges, issueId]) // Added user, getNode, getNodes, edges, issueId

    const handleTagClick = useCallback((nodeId, currentTag) => {
        setActiveTagEdit({ nodeId, currentTag })
    }, [])

    const handleConfirmTag = async () => {
        if (confirmText !== "Confirm") {
            toast.error("Validation Failed", { description: "You must type exactly 'Confirm'." })
            return
        }

        try {
            if (tagConfirm.nodeId === "MODAL_ACTION") {
                // We are responding to the Node Info Modal's confirmation request
                setIsLoading(true)
                const payload = tagConfirm.payload

                if (tagConfirm.mode === "edit") {
                    // Snapshot current values for undo
                    const prevData = activeNodeModal.nodeParams.data
                    const undoPayload = {
                        nodeId: activeNodeModal.nodeParams.id,
                        previousHeader: prevData.label,
                        previousDescription: prevData.description,
                        previousCode: prevData.code_changes,
                        previousLang: prevData.code_language
                    }

                    await api.updateNodeInfo(activeNodeModal.nodeParams.id, {
                        issue_header: payload.header,
                        description: payload.description,
                        code_changes: payload.code,
                        code_language: payload.lang,
                        emp_id: user?.emp_id || "SYS",
                        role: user?.role?.toLowerCase() || "team_member"
                    })

                    // If this update was part of a merge flow, complete the merge now
                    if (pendingMerge && pendingMerge.originBlueNodeId === activeNodeModal.nodeParams.id) {
                        await handleFinalizeMerge(activeNodeModal.nodeParams.id, {
                            header: payload.header,
                            description: payload.description,
                            code_changes: payload.code,
                            code_language: payload.lang
                        });
                    } else {
                        toast.success("Node Information Updated")
                    }
                    // Push undo entry
                    undoStackRef.current.push({ type: 'UNDO_NODE_UPDATE', payload: undoPayload, description: 'node info update' })
                }

                setActiveNodeModal(null)
                setTagConfirm(null)
                setConfirmText("")
                setRefreshKey(prev => prev + 1)
            } else {
                const commentToSubmit = seniorCommentText;
                const previousTag = tagConfirm.previousTag;

                // Optimistic Update
                setNodes(nds => nds.map(n => n.id === tagConfirm.nodeId ? { ...n, data: { ...n.data, tag: tagConfirm.newTag, senior_comment: commentToSubmit } } : n))

                // Silent Knight: Pass the last_updated_at for OCC verification
                const nodeToTag = nodes.find(n => n.id === tagConfirm.nodeId)
                await api.tagIssueNode(tagConfirm.nodeId, tagConfirm.newTag, {
                    senior_comment: commentToSubmit
                }, nodeToTag?.data?.updated_at)

                toast.success("Tag Updated Successfully")

                // Push undo entry
                undoStackRef.current.push({ type: 'UNDO_TAG_CHANGE', payload: { nodeId: tagConfirm.nodeId, previousTag }, description: 'tag change' })

                setTagConfirm(null)
                setConfirmText("")
                setRefreshKey(prev => prev + 1)
            }
        } catch (err) {
            toast.error("Update failed", { description: err.message })
            // Refresh graph to revert on failure
            setRefreshKey(prev => prev + 1)
            setIsLoading(false)
        }
    }

    const onConnect = useCallback((params) => {
        // Prevent connecting node to itself
        if (params.source === params.target) return
        // Red-node read-only: block connections when graph is closed
        const allNodes = getNodes()
        if (allNodes.some(n => n.data?.tag === 'red')) {
            toast.error("Graph is closed. No modifications allowed.")
            return
        }
        setConnectConfirm(params)
    }, [getNodes])

    const handleConfirmConnect = async () => {
        if (confirmText !== "Confirm") {
            toast.error("Validation Failed", { description: "You must type exactly 'Confirm'." })
            return
        }

        try {
            setIsLoading(true)
            const sourceNodeId = connectConfirm.source
            const targetNodeId = connectConfirm.target

            // ─── DIRECTION-INDEPENDENT GATEKEEPER SEARCH ───
            const traceGatekeeper = (startId) => {
                let currId = startId;
                const trail = [];
                while (currId) {
                    const node = nodes.find(n => n.id === currId);
                    if (!node || node.data?.tag !== 'blue') break;

                    const parentEdge = edges.find(e => e.target === currId);
                    if (!parentEdge) break;

                    const parentNode = nodes.find(n => n.id === parentEdge.source);
                    if (parentNode && parentNode.data?.tag === 'green') {
                        return { gatekeeperId: currId, trail };
                    }

                    trail.push(currId);
                    currId = parentEdge.source;
                }
                return null;
            };

            const sourceTrace = traceGatekeeper(sourceNodeId);
            const targetTrace = traceGatekeeper(targetNodeId);

            // Prioritize the trace that actually found a gatekeeper
            const activeTrace = sourceTrace || targetTrace;

            if (activeTrace) {
                const { gatekeeperId, trail } = activeTrace;
                const originNode = nodes.find(n => n.id === gatekeeperId);

                if (originNode) {
                    setPendingMerge({
                        originBlueNodeId: gatekeeperId,
                        branchTrail: trail,
                        sourceNodeId,
                        targetNodeId
                    })

                    setModalHeader(originNode.data.label || "")
                    setModalDescription(originNode.data.description || "")
                    setModalCode(originNode.data.code_changes || "")
                    setModalLang(originNode.data.code_language || "Python")

                    setActiveNodeModal({
                        mode: "edit",
                        nodeParams: originNode,
                        canEdit: true,
                        isGraphClosed: false
                    })

                    toast.info("Merge Documentation Required", {
                        description: "Finalize the documentation for the branch entry node to proceed with merge."
                    })
                }
            } else {
                await api.connectNode(sourceNodeId, targetNodeId, user?.emp_id || "SYS")
                toast.success("Nodes Connected Successfully")
            }

            setConnectConfirm(null)
            setConfirmText("")
            setRefreshKey(prev => prev + 1)
        } catch (err) {
            toast.error("Operation failed", { description: err.message })
            setConnectConfirm(null)
            setConfirmText("")
            setIsLoading(false)
        }
    }

    const executeDeleteNode = async () => {
        if (confirmText !== "Confirm") {
            toast.error("Validation Failed", { description: "You must type exactly 'Confirm'." })
            return
        }

        try {
            setIsLoading(true)
            const nodeId = deleteConfirm.nodeId

            // Snapshot node data for undo BEFORE deleting
            const fullNode = getNode(nodeId)
            const connectedEdges = edges.filter(e => e.source === nodeId || e.target === nodeId)
            const parentEdge = connectedEdges.find(e => e.target === nodeId)
            const undoSnapshot = {
                id: nodeId,
                root_issue_id: issueId,
                parent_node_id: parentEdge ? parentEdge.source : null,
                header: fullNode?.data?.label,
                description: fullNode?.data?.description,
                node_type: fullNode?.data?.type || 'update',
                tag: fullNode?.data?.tag || 'pending',
                created_by_emp_id: fullNode?.data?.author,
                code_changes: fullNode?.data?.code_changes,
                code_language: fullNode?.data?.code_language,
                created_at: fullNode?.data?.created_at,
                layout_x: fullNode?.position?.x,
                layout_y: fullNode?.position?.y
            }

            await api.deleteIssueNode(nodeId)

            // Immediately update local state
            setNodes(nds => nds.filter(n => n.id !== nodeId))
            setEdges(eds => eds.filter(e => e.source !== nodeId && e.target !== nodeId))

            toast.success("Node Terminated Successfully")

            // Push undo entry
            undoStackRef.current.push({ type: 'UNDO_DELETE_NODE', payload: undoSnapshot, description: 'node deletion' })

            // Cleanup state
            setDeleteConfirm(null)
            setActiveNodeModal(null)
            setConfirmText("")
            setRefreshKey(prev => prev + 1)
        } catch (err) {
            toast.error("Termination failed", { description: err.message })
            setRefreshKey(prev => prev + 1)
            setIsLoading(false)
        }
    }

    const handleNodeClick = useCallback((event, node) => {
        // Open node modal. Root node or child.
        // User identity check logic
        const authorEmpId = node.data.author
        const currentUserEmpId = user?.emp_id
        const isAuthor = authorEmpId === currentUserEmpId

        // Check if graph is closed (any red node = closed)
        const allNodes = getNodes()
        const isGraphClosed = allNodes.some(n => n.data?.tag === 'red')

        // Populate modal state
        setModalHeader(node.data.label || "")
        setModalDescription(node.data.description || "")
        setModalCode(node.data.code_changes || "")
        setModalLang(node.data.code_language || "Python")

        // If author OR senior, open in view mode but show footer actions. Else just view mode.
        const permissions = getNodePermissions(node.data, user)
        setActiveNodeModal({
            mode: "view",
            nodeParams: node,
            canEdit: permissions.canEdit && !isGraphClosed,
            isGraphClosed
        })
    }, [user, getNodes])

    const handleAddNode = useCallback(async (parentId, direction) => {
        // Red-node read-only: block adding nodes when graph is closed
        const allNodes = getNodes()
        if (allNodes.some(n => n.data?.tag === 'red')) {
            toast.error("Graph is closed. No modifications allowed.")
            return
        }

        // Restriction check for team members: only one pending node allowed
        const permissions = getNodePermissions(null, user)
        if (!permissions.isSenior) {
            const hasPendingNode = allNodes.some(n =>
                n.data?.author === user?.emp_id && n.data?.tag === 'pending'
            )
            if (hasPendingNode) {
                toast.error("Creation Blocked", {
                    description: "You already have a pending node. Please wait for senior review or remove your existing pending node before adding another."
                })
                return
            }
        }

        setIsLoading(true)
        const authorName = user?.emp_id || user?.email?.split('@')[0] || 'USER'

        const parentNode = getNode(parentId)
        let newX = parentNode ? parentNode.position.x : 0
        let newY = parentNode ? parentNode.position.y : 0

        const dx = direction === 'left' ? -320 : direction === 'right' ? 320 : 0
        const dy = direction === 'top' ? -160 : direction === 'bottom' ? 160 : 0

        newX += dx
        newY += dy

        // Grid Snapping Collision Resolver
        const currentNodes = getNodes()
        let isOccupied = true
        while (isOccupied) {
            isOccupied = currentNodes.some(n =>
                Math.abs(n.position.x - newX) < 10 && Math.abs(n.position.y - newY) < 10
            )
            if (isOccupied) {
                if (dy !== 0) newY += dy // cascade downwards or upwards
                if (dx !== 0) newX += dx // cascade laterally
            }
        }

        try {
            const result = await api.createIssue({
                type: "existing",
                parent_issue_id: parentId,
                issue_subheader: "NEW ISSUE",
                date: new Date().toISOString().split('T')[0],
                description: "Auto-generated flowchart node",
                created_by: authorName,
                emp_id: user?.emp_id || "SYS",
                dept_id: user?.dept_id || "SYS",
                layout_x: newX,
                layout_y: newY
            })
            toast.success("Node Added Successfully")

            // Push undo entry — undo = delete the newly created node
            if (result?.issue_id) {
                undoStackRef.current.push({ type: 'UNDO_ADD_NODE', payload: { nodeId: result.issue_id }, description: 'node addition' })
            }

            setRefreshKey(prev => prev + 1)
        } catch (err) {
            toast.error("Failed to add node", { description: err.message })
            setIsLoading(false)
        }
    }, [user, nodes])

    const loadGraph = useCallback(async () => {
        if (!issueId) return
        setIsLoading(true)
        try {
            const data = await api.getIssueGraph(issueId)

            // Map backend data to React Flow format
            const initialNodes = data.nodes.map(n => ({
                id: n.id,
                type: 'custom',
                data: {
                    ...n.data,
                    userRole: user?.role?.toLowerCase(),
                    ...getNodePermissions(n.data, user),
                    senior_comment: n.data.senior_comment,
                    date: n.data.created_at ? new Date(n.data.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase() : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase(),
                    onAddNode: handleAddNode,
                    onTagClick: handleTagClick
                },
                position: { x: 0, y: 0 }, // Handled by dagre layout generator
            }))

            const initialEdges = data.edges.map(e => ({
                id: e.id,
                source: e.source,
                target: e.target,
                type: 'smoothstep',
                animated: true,
                style: { stroke: 'var(--accent-blue-bright)', strokeWidth: 3 },
            }))

            const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
                initialNodes,
                initialEdges
            )

            // Inject graph context but avoid circular recursion
            const contextNodes = layoutedNodes.map(n => {
                // Calculate "Blue Barrier" blocking status pre-rendering
                let isBlocked = false;
                if (n.data?.tag === 'blue') {
                    const children = layoutedEdges.filter(e => e.source === n.id);
                    const sideChildren = children.filter(e => {
                        const targetNode = layoutedNodes.find(ln => ln.id === e.target);
                        if (!targetNode) return false;
                        const dx = targetNode.position.x - n.position.x;
                        const dy = targetNode.position.y - n.position.y;
                        return Math.abs(dx) > Math.abs(dy); // Horizontal connection
                    });
                    const hasValidatedSide = sideChildren.some(e => {
                        const targetNode = layoutedNodes.find(ln => ln.id === e.target);
                        return targetNode?.data?.tag === 'blue' || targetNode?.data?.tag === 'green';
                    });
                    isBlocked = !hasValidatedSide;
                }

                return {
                    ...n,
                    data: {
                        ...n.data,
                        isBlocked
                    }
                };
            });

            setNodes(contextNodes)
            setEdges(layoutedEdges)
        } catch (err) {
            toast.error("Failed to load graph", { description: err.message })
        } finally {
            setIsLoading(false)
        }
    }, [issueId, setNodes, setEdges])

    useEffect(() => {
        loadGraph()
    }, [loadGraph, refreshKey])

    if (isLoading) {
        return (
            <div className="absolute inset-0 flex items-center justify-center">
                <CortexLoader />
            </div>
        )
    }

    if (!nodes.length) {
        return (
            <div className="absolute inset-0 flex items-center justify-center text-secondary-custom font-mono">
                GRAPH DATA UNAVAILABLE
            </div>
        )
    }

    return (
        <motion.div {...FADE_IN} className="absolute inset-0" style={{ background: "var(--bg-root)" }}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={handleNodeClick}
                onNodeDragStart={onNodeDragStart}
                onNodeDrag={onNodeDrag}
                onNodeDragStop={onNodeDragStop}
                nodesDraggable={true}
                dragHandle=".drag-handle"
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                minZoom={0.1}
                maxZoom={1.5}
                proOptions={{ hideAttribution: true }}
                connectionLineType="smoothstep"
                defaultEdgeOptions={{
                    type: 'smoothstep',
                    animated: true,
                    style: { stroke: 'var(--text-secondary)', strokeWidth: 2, strokeDasharray: '5 5' }
                }}
            >
                <Background color="#333" gap={16} />
                <Controls className="custom-flow-controls" showInteractive={false} />
                <MiniMap
                    className="!bg-[var(--bg-panel)] !border-subtle-custom rounded-lg overflow-hidden"
                    style={{ backgroundColor: "var(--bg-panel)" }}
                    maskColor="rgba(0, 0, 0, 0.7)"
                    nodeColor={(n) => NODE_COLORS[n.data?.tag]?.border || "#8e8e93"}
                />
            </ReactFlow>

            {/* Top-right floating indicator */}
            <div className="absolute top-4 right-4 bg-surface-custom/80 backdrop-blur border border-subtle-custom px-4 py-2 rounded-lg pointer-events-none z-10 shadow-lg">
                <div className="text-xs font-mono text-primary-custom font-bold">DAG: {issueId}</div>
                <div className="text-[10px] font-mono text-secondary-custom">Execution Ledger Graph</div>
            </div>

            {/* Trash Zone */}
            <AnimatePresence>
                {isDraggingNode && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        id="trash-zone"
                        className={`absolute top-0 left-0 right-0 h-20 flex items-center justify-center z-[100] transition-colors duration-300 pointer-events-none ${isHoveringTrash
                            ? "bg-gradient-to-b from-red-600/60 to-transparent backdrop-blur-sm"
                            : "bg-gradient-to-b from-red-500/20 to-transparent backdrop-blur-sm"
                            }`}
                    >
                        <svg className={`transition-all duration-300 ${isHoveringTrash ? "scale-110 text-red-100" : "scale-100 text-red-300/50"}`} width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                            <path d="M10 11v6" />
                            <path d="M14 11v6" />
                            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                        </svg>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Editing Modals */}
            <AnimatePresence>
                {activeTagEdit && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[300] backdrop-blur-xl bg-black/40 flex items-center justify-center p-4"
                        onClick={() => setActiveTagEdit(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="bg-surface-custom border border-subtle-custom p-6 rounded-2xl shadow-2xl flex flex-col gap-4 min-w-[300px]"
                            onClick={e => e.stopPropagation()}
                        >
                            <h3 className="text-secondary-custom font-mono text-sm uppercase tracking-widest text-center mb-2">SELECT NEW STATUS</h3>
                            <div className="flex flex-col gap-3">
                                {['pending', 'yellow', 'blue', 'green', 'red'].map(opt => (
                                    <button
                                        key={opt}
                                        onClick={() => {
                                            setActiveTagEdit(null)
                                            setTagConfirm({
                                                nodeId: activeTagEdit.nodeId,
                                                newTag: opt,
                                                previousTag: activeTagEdit.currentTag,
                                                seniorComment: ""
                                            })
                                            setSeniorCommentText("")
                                        }}
                                        className="py-3 px-4 rounded-xl font-mono uppercase font-bold text-center transition-all border hover:scale-105 active:scale-95"
                                        style={{ color: NODE_COLORS[opt].text, backgroundColor: NODE_COLORS[opt].bg, borderColor: NODE_COLORS[opt].border }}
                                    >
                                        {opt}
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    </motion.div>
                )}

                {tagConfirm && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[400] backdrop-blur-xl bg-black/50 flex items-center justify-center p-4"
                        onClick={() => setTagConfirm(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="bg-surface-custom border border-subtle-custom p-8 rounded-2xl shadow-2xl flex flex-col gap-6 max-w-sm w-full"
                            onClick={e => e.stopPropagation()}
                        >
                            <h3 className="text-white font-mono text-lg font-bold text-center uppercase">CONFIRM TAG CHANGE</h3>
                            <p className="text-secondary-custom text-sm font-mono text-center">
                                To confirm, type <span className="text-white font-bold">"Confirm"</span> and press Proceed
                            </p>

                            <Input
                                value={confirmText}
                                onChange={e => setConfirmText(e.target.value)}
                                placeholder="Type Confirm"
                                className="text-center font-mono border-subtle-custom bg-[var(--bg-root)] focus:border-[var(--accent-blue-bright)] soft-glow-hover"
                                onKeyDown={e => {
                                    if (e.key === "Enter" && (tagConfirm.newTag !== "blue" || seniorCommentText.trim())) handleConfirmTag()
                                }}
                            />

                            {/* ADDED: Senior Comment for Blue nodes */}
                            {tagConfirm.newTag === "blue" && (
                                <div className="flex flex-col gap-2">
                                    <label className="text-[10px] font-mono text-[var(--accent-blue-bright)] uppercase tracking-widest font-bold">Mandatory Senior Comment</label>
                                    <textarea
                                        value={seniorCommentText}
                                        onChange={e => setSeniorCommentText(e.target.value)}
                                        placeholder="Explain why this is accepted but incomplete..."
                                        className="w-full h-24 bg-[var(--bg-root)] border border-subtle-custom rounded-lg p-3 text-xs font-mono text-primary-custom focus:border-[var(--accent-blue-bright)] outline-none resize-none soft-glow-hover"
                                    />
                                </div>
                            )}

                            <div className="flex gap-4 mt-2">
                                <Button
                                    onClick={() => { setTagConfirm(null); setConfirmText(""); }}
                                    className="flex-1 bg-transparent border border-subtle-custom text-secondary-custom hover:text-white hover:bg-white/5 transition-all"
                                >
                                    CANCEL
                                </Button>
                                <Button
                                    onClick={() => {
                                        if (tagConfirm.newTag === "blue" && !seniorCommentText.trim()) {
                                            toast.error("Comment Required", { description: "Please provide a reason for the Blue status." });
                                            return;
                                        }
                                        handleConfirmTag();
                                    }}
                                    className="flex-1 gradient-button text-white font-bold soft-shadow"
                                    disabled={confirmText !== "Confirm" || (tagConfirm.newTag === "blue" && !seniorCommentText.trim())}
                                >
                                    PROCEED
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}

                {connectConfirm && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[400] backdrop-blur-xl bg-black/50 flex items-center justify-center p-4"
                        onClick={() => setConnectConfirm(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="bg-surface-custom border border-subtle-custom p-8 rounded-2xl shadow-2xl flex flex-col gap-6 max-w-sm w-full"
                            onClick={e => e.stopPropagation()}
                        >
                            <h3 className="text-white font-mono text-lg font-bold text-center uppercase text-accent-blue-bright">MERGE BRANCHES</h3>
                            <p className="text-secondary-custom text-sm font-mono text-center">
                                You are forming a structural connection to merge these branches without severing their lineages. To confirm, type <span className="text-white font-bold">"Confirm"</span> and press Proceed.
                            </p>

                            <Input
                                value={confirmText}
                                onChange={e => setConfirmText(e.target.value)}
                                placeholder="Type Confirm"
                                className="text-center font-mono border-subtle-custom bg-[var(--bg-root)] focus:border-[var(--accent-blue-bright)] soft-glow-hover"
                                onKeyDown={e => {
                                    if (e.key === "Enter") handleConfirmConnect()
                                }}
                            />

                            <div className="flex gap-4 mt-2">
                                <Button
                                    onClick={() => { setConnectConfirm(null); setConfirmText(""); }}
                                    className="flex-1 bg-transparent border border-subtle-custom text-secondary-custom hover:text-white hover:bg-white/5 transition-all"
                                >
                                    CANCEL
                                </Button>
                                <Button
                                    onClick={handleConfirmConnect}
                                    className="flex-1 bg-red-600/80 text-white font-bold soft-shadow hover:bg-red-500"
                                >
                                    PROCEED
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}

                {deleteConfirm && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[400] backdrop-blur-xl bg-black/50 flex items-center justify-center p-4"
                        onClick={() => setDeleteConfirm(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="bg-surface-custom border border-subtle-custom p-8 rounded-2xl shadow-2xl flex flex-col gap-6 max-w-sm w-full"
                            onClick={e => e.stopPropagation()}
                        >
                            <h3 className="text-white font-mono text-lg font-bold text-center uppercase text-red-500">REMOVE NODE</h3>
                            <p className="text-secondary-custom text-sm font-mono text-center">
                                Are you sure you want to terminate <span className="text-white font-bold">"{deleteConfirm.label}"</span>? This action cannot be easily undone. To confirm, type <span className="text-white font-bold">"Confirm"</span> and press Proceed.
                            </p>

                            <Input
                                value={confirmText}
                                onChange={e => setConfirmText(e.target.value)}
                                placeholder="Type Confirm"
                                className="text-center font-mono border-subtle-custom bg-[var(--bg-root)] focus:border-red-500 soft-glow-hover"
                                onKeyDown={e => {
                                    if (e.key === "Enter" && confirmText === "Confirm") executeDeleteNode()
                                }}
                            />
                            {/* Note: In the above input, I accidentally used setDeleteConfirm to set confirmText but confirmText is a root state. Let me fix that. */}

                            <div className="flex gap-4 mt-2">
                                <Button
                                    onClick={() => { setDeleteConfirm(null); setConfirmText(""); }}
                                    className="flex-1 bg-transparent border border-subtle-custom text-secondary-custom hover:text-white hover:bg-white/5 transition-all"
                                >
                                    CANCEL
                                </Button>
                                <Button
                                    onClick={executeDeleteNode}
                                    disabled={confirmText !== "Confirm"}
                                    className="flex-1 bg-red-600/80 text-white font-bold soft-shadow hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    PROCEED
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}

                {/* --- NODE INFO MODAL --- */}
                {activeNodeModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[200] backdrop-blur-3xl bg-black/40 flex items-center justify-center p-4"
                        onClick={() => {
                            if (activeNodeModal.mode === "view") setActiveNodeModal(null);
                        }}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 10 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 10 }}
                            className="rounded-2xl shadow-2xl w-full max-w-2xl p-[2px] relative group"
                            onClick={e => e.stopPropagation()}
                            style={{ background: "#1a1a2e" }}
                        >
                            {/* Gradient overlay — fades in on hover */}
                            <div
                                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 pointer-events-none"
                                style={{
                                    background: (() => {
                                        const tag = activeNodeModal.nodeParams?.data?.tag
                                        const tagColor = {
                                            green: "#34c759",
                                            blue: "#00bfff",
                                            red: "#ff3b30",
                                            yellow: "#ffbf00",
                                        }[tag] || "#8e8e93"
                                        return `linear-gradient(to bottom right, #1a1a2e, ${tagColor})`
                                    })(),
                                    transition: "opacity 0.4s ease-in-out"
                                }}
                            />
                            <div className="bg-surface-custom rounded-2xl flex flex-col w-full overflow-y-auto custom-scrollbar relative" style={{ maxHeight: "calc(85vh - 4px)" }}>

                                {/* Close cross for edit */}
                                {activeNodeModal.mode === "edit" && (
                                    <button
                                        onClick={() => setActiveNodeModal(null)}
                                        className="absolute top-4 right-4 text-secondary-custom hover:text-white transition-colors"
                                    >
                                        <span className="text-xl font-bold font-mono">×</span>
                                    </button>
                                )}

                                <div className="p-6 flex flex-col gap-6 overflow-y-auto custom-scrollbar">

                                    {activeNodeModal.mode === "view" ? (
                                        /* --- READ-ONLY VIEW MODE --- */
                                        <div className="flex flex-col gap-5">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h2 className="text-xl font-mono font-bold text-white uppercase tracking-widest break-words pr-8">
                                                        {activeNodeModal.nodeParams.data.label}
                                                    </h2>
                                                    <p className="text-xs font-mono text-secondary-custom mt-2 border-l-2 border-subtle-custom pl-2 uppercase tracking-widest">
                                                        AUTHOR: <span className="text-primary-custom ml-1">{activeNodeModal.nodeParams.data.author}</span>
                                                    </p>
                                                </div>
                                                <div className="text-[10px] uppercase font-mono font-bold px-2 py-1 rounded bg-black/40 border border-subtle-custom text-secondary-custom">
                                                    {activeNodeModal.nodeParams.data.tag}
                                                </div>
                                            </div>

                                            {activeNodeModal.nodeParams.data.description && (
                                                <div className="bg-black/20 p-4 rounded-lg border border-subtle-custom/50">
                                                    <div className="text-[10px] text-secondary-custom font-mono uppercase tracking-widest mb-2 font-bold">Description</div>
                                                    <p className="text-sm text-primary-custom whitespace-pre-wrap font-mono leading-relaxed">
                                                        {activeNodeModal.nodeParams.data.description}
                                                    </p>
                                                </div>
                                            )}

                                            {activeNodeModal.mode === "view" && activeNodeModal.nodeParams.data.senior_comment && (
                                                <div className="bg-accent-blue-bright/10 p-4 rounded-lg border border-accent-blue-bright/30">
                                                    <div className="text-[10px] text-accent-blue-bright font-mono uppercase tracking-widest mb-2 font-bold">Senior Note</div>
                                                    <p className="text-sm text-primary-custom font-mono leading-tight">
                                                        "{activeNodeModal.nodeParams.data.senior_comment}"
                                                    </p>
                                                </div>
                                            )}

                                            {activeNodeModal.nodeParams.data.code_changes && (
                                                <div className="bg-black/40 rounded-lg border border-subtle-custom/50 overflow-hidden flex flex-col">
                                                    <div className="flex justify-between items-center bg-surface-custom px-4 py-2 border-b border-subtle-custom/50">
                                                        <div className="text-[10px] text-secondary-custom font-mono uppercase tracking-widest font-bold">Codebase Changes</div>
                                                        <div className="text-[10px] text-accent-blue-bright font-mono uppercase tracking-widest font-bold bg-accent-blue-bright/10 px-2 py-0.5 rounded">
                                                            {activeNodeModal.nodeParams.data.code_language || "TEXT"}
                                                        </div>
                                                    </div>
                                                    <div className="relative text-sm custom-scrollbar max-h-64 overflow-auto bg-[#141414]">
                                                        <Editor
                                                            value={activeNodeModal.nodeParams.data.code_changes}
                                                            onValueChange={() => { }} // Read-only
                                                            highlight={code => Prism.highlight(code, getPrismLanguage(activeNodeModal.nodeParams.data.code_language), activeNodeModal.nodeParams.data.code_language?.toLowerCase() || 'javascript')}
                                                            padding={16}
                                                            className="font-mono text-xs leading-relaxed"
                                                            textareaClassName="focus:outline-none"
                                                            disabled
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {/* Action footer for Author/Senior to flip to edit mode or delete */}
                                            {activeNodeModal.canEdit && !activeNodeModal.nodeParams.id.startsWith("ISS-") && (
                                                <div className="pt-4 mt-2 flex justify-between items-center border-t border-subtle-custom gap-4">
                                                    {(() => {
                                                        const permissions = getNodePermissions(activeNodeModal.nodeParams.data, user)

                                                        if (permissions.canEdit) {
                                                            return (
                                                                <Button
                                                                    onClick={() => {
                                                                        setDeleteConfirm({
                                                                            nodeId: activeNodeModal.nodeParams.id,
                                                                            label: activeNodeModal.nodeParams.data.label
                                                                        });
                                                                        setConfirmText("");
                                                                    }}
                                                                    className="bg-transparent border border-red-500/50 text-red-500 hover:bg-red-500/10 font-mono text-xs uppercase tracking-widest px-6"
                                                                >
                                                                    [ REMOVE NODE ]
                                                                </Button>
                                                            )
                                                        }
                                                        return <div />;
                                                    })()}

                                                    <Button
                                                        onClick={() => {
                                                            setActiveNodeModal({ ...activeNodeModal, mode: "edit" });
                                                        }}
                                                        className="bg-transparent border border-accent-blue-bright/50 text-accent-blue-bright hover:bg-accent-blue-bright/10 font-mono text-xs uppercase tracking-widest px-6 ml-auto"
                                                    >
                                                        [ EDIT INFO ]
                                                    </Button>
                                                </div>
                                            )}
                                            {/* Author check for root issue - we can allow roots to be edited too if they are the author, but typically you update the nodes */}
                                            {activeNodeModal.isAuthor && activeNodeModal.nodeParams.id.startsWith("ISS-") && (
                                                <div className="pt-4 mt-2 flex justify-end border-t border-subtle-custom">
                                                    <Button
                                                        onClick={() => {
                                                            setActiveNodeModal({ ...activeNodeModal, mode: "edit" });
                                                        }}
                                                        className="bg-transparent border border-accent-blue-bright/50 text-accent-blue-bright hover:bg-accent-blue-bright/10 font-mono text-xs uppercase tracking-widest px-6"
                                                    >
                                                        [ EDIT ROOT ]
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        /* --- EDIT FORM MODE --- */
                                        <div className="flex flex-col gap-6">
                                            <div className="text-xl font-mono font-bold text-white uppercase tracking-widest mb-2 border-b border-subtle-custom pb-4">
                                                EDIT NODE DATA
                                            </div>

                                            <div className="flex flex-col gap-2">
                                                <label className="text-xs font-semibold uppercase tracking-wider text-secondary-custom">Issue Header</label>
                                                <Input
                                                    value={modalHeader}
                                                    onChange={e => setModalHeader(e.target.value)}
                                                    placeholder="Brief title of the issue"
                                                    maxLength={120}
                                                    className="bg-[var(--bg-panel)] border-subtle-custom text-white h-12 focus-visible:ring-1 focus-visible:ring-accent-blue-bright focus-visible:border-accent-blue-bright soft-glow-hover transition-all duration-300"
                                                />
                                            </div>

                                            <div className="flex gap-6">
                                                <div className="flex flex-col gap-2 flex-1">
                                                    <label className="text-xs font-semibold uppercase tracking-wider text-secondary-custom">Created By</label>
                                                    <div className="bg-[var(--bg-panel)]/50 border border-subtle-custom/50 rounded-md px-3 h-12 flex items-center text-primary-custom/60 cursor-not-allowed">
                                                        {user?.full_name || user?.email?.split('@')[0] || "USER"}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-2 flex-1 relative">
                                                    <label className="text-xs font-semibold uppercase tracking-wider text-secondary-custom">EmpID</label>
                                                    <div className="bg-[var(--bg-panel)]/50 border border-subtle-custom/50 rounded-md px-3 h-12 flex items-center text-primary-custom/60 cursor-not-allowed">
                                                        {user?.emp_id || "SYS"}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex flex-col gap-2 relative">
                                                <div className="flex justify-between items-end">
                                                    <label className="text-xs font-semibold uppercase tracking-wider text-secondary-custom">Description</label>
                                                    <span className="text-[10px] text-secondary-custom/60 font-medium">Max 500 words</span>
                                                </div>
                                                <textarea
                                                    value={modalDescription}
                                                    onChange={e => setModalDescription(e.target.value)}
                                                    placeholder="Describe the issue in detail..."
                                                    className="w-full h-32 p-4 text-sm bg-[var(--bg-panel)] border border-subtle-custom rounded-lg focus:outline-none focus:border-accent-blue-bright focus:ring-1 focus:ring-accent-blue-bright resize-none custom-scrollbar text-white soft-glow-hover transition-all duration-300"
                                                />
                                            </div>

                                            <div className="flex flex-col gap-2">
                                                <div className="flex justify-between items-center mb-1">
                                                    <label className="text-xs font-semibold uppercase tracking-wider text-secondary-custom">Changes In Codebase <span className="text-[10px] text-secondary-custom/60 ml-2">(Optional)</span></label>
                                                    <LanguageDropdown value={modalLang} onChange={setModalLang} />
                                                </div>
                                                <div className="bg-[var(--bg-panel)] border border-subtle-custom rounded-lg p-4 text-sm overflow-hidden h-40 focus-within:ring-1 focus-within:ring-accent-blue-bright focus-within:border-accent-blue-bright transition-all duration-300 relative soft-glow-hover">
                                                    <div className="absolute inset-0 overflow-auto custom-scrollbar">
                                                        <Editor
                                                            value={modalCode}
                                                            onValueChange={code => setModalCode(code)}
                                                            highlight={code => Prism.highlight(code, getPrismLanguage(modalLang), modalLang?.toLowerCase() || 'javascript')}
                                                            padding={16} // Matches the p-4 we removed from the container
                                                            placeholder={`// Provide snippets here in ${modalLang}...`}
                                                            className="font-mono text-sm leading-relaxed min-h-[120px]"
                                                            textareaClassName="focus:outline-none"
                                                            style={{
                                                                minHeight: '100%',
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="pt-6 mt-2 flex gap-4 justify-end border-t border-subtle-custom">
                                                <Button
                                                    variant="outline"
                                                    onClick={() => {
                                                        setActiveNodeModal({ ...activeNodeModal, mode: "view" });
                                                    }}
                                                    className="bg-transparent border border-subtle-custom text-secondary-custom hover:text-white hover:bg-white/5 font-semibold text-xs tracking-wider uppercase px-6 h-11"
                                                >
                                                    CANCEL
                                                </Button>
                                                <Button
                                                    onClick={async () => {
                                                        if (!modalHeader.trim() || !modalDescription.trim()) {
                                                            toast.error("Validation Failed", { description: "Header and Description are required." });
                                                            return;
                                                        }

                                                        setIsLoading(true)
                                                        try {
                                                            const docData = {
                                                                header: modalHeader,
                                                                description: modalDescription,
                                                                code_changes: modalCode,
                                                                code_language: modalLang,
                                                                emp_id: user?.emp_id || "SYS"
                                                            };

                                                            await api.updateNodeInfo(activeNodeModal.nodeParams.id, {
                                                                issue_header: modalHeader,
                                                                description: modalDescription,
                                                                code_changes: modalCode,
                                                                code_language: modalLang,
                                                                emp_id: user?.emp_id || "SYS"
                                                            }, activeNodeModal.nodeParams.data?.updated_at)

                                                            // Check if this update completes a pending merge
                                                            if (pendingMerge && pendingMerge.originBlueNodeId === activeNodeModal.nodeParams.id) {
                                                                await handleFinalizeMerge(activeNodeModal.nodeParams.id, docData);
                                                            } else {
                                                                toast.success("Node Information Updated")
                                                            }

                                                            setActiveNodeModal(null)
                                                            setRefreshKey(prev => prev + 1)
                                                        } catch (err) {
                                                            toast.error("Update failed", { description: err.message })
                                                        } finally {
                                                            setIsLoading(false)
                                                        }
                                                    }}
                                                    className="gradient-button text-white font-bold soft-shadow tracking-wider uppercase px-8 h-11 rounded-md"
                                                >
                                                    UPDATE INFO
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}

            </AnimatePresence>

            <style>{`
                /* ── ReactFlow Controls ── */
                .custom-flow-controls {
                    background-color: var(--bg-panel) !important;
                    border: 1px solid var(--border-subtle) !important;
                    border-radius: 8px !important;
                    overflow: hidden;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.5) !important;
                }
                .custom-flow-controls button {
                    background-color: transparent !important;
                    border-bottom: 1px solid var(--border-subtle) !important;
                    fill: var(--text-secondary) !important;
                    transition: all 0.2s;
                }
                .custom-flow-controls button:last-child {
                    border-bottom: none !important;
                }
                .custom-flow-controls button:hover {
                    background-color: var(--surface-primary) !important;
                    fill: var(--accent-blue-bright) !important;
                }

                /* ── Node Drag Handle ── */
                .cortex-node {
                    transition: transform 0.2s ease, border-radius 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), corner-shape 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
                    overflow: hidden;
                }
                .cortex-node:hover {
                    transform: scale(1.03);
                }
                /* Progressive enhancement: scoop corner when browser supports it */
                @supports (corner-shape: scoop) {
                    .cortex-node {
                        corner-shape: round;
                    }
                    .cortex-node:hover {
                        corner-shape: scoop round round round;
                        border-radius: 28px 12px 12px 12px;
                    }
                }
                .cortex-node-drag {
                    position: absolute;
                    top: -14px;
                    left: -14px;
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: rgba(255, 255, 255, 0.9);
                    cursor: grab;
                    scale: 0;
                    transition: scale 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
                    box-shadow: 0 3px 12px rgba(0, 0, 0, 0.3);
                    z-index: 60;
                }
                .cortex-node-drag:active {
                    cursor: grabbing;
                }
                .node-wrapper:hover .cortex-node-drag {
                    scale: 1;
                }
            `}</style>
        </motion.div>
    )
}
