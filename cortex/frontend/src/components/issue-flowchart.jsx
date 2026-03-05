import { useState, useCallback, useEffect } from "react"
import {
    ReactFlow,
    Background,
    Controls,
    MiniMap,
    useNodesState,
    useEdgesState,
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

// ─── Custom Node Configurations ────────────────────────────────────

const NODE_COLORS = {
    pending: { bg: "rgba(142, 142, 147, 0.1)", border: "#8e8e93", text: "#8e8e93" },
    yellow: { bg: "rgba(255, 204, 0, 0.15)", border: "#ffcc00", text: "#e6b800" },
    blue: { bg: "rgba(0, 191, 255, 0.15)", border: "#00bfff", text: "#00bfff" },
    green: { bg: "rgba(52, 199, 89, 0.15)", border: "#34c759", text: "#34c759" },
    red: { bg: "rgba(255, 59, 48, 0.15)", border: "#ff3b30", text: "#ff3b30" },
}

const PlusButton = ({ position, onClick }) => {
    let posClass = ""
    if (position === Position.Top) posClass = "-top-2 left-1/2 -translate-x-1/2"
    if (position === Position.Bottom) posClass = "-bottom-2 left-1/2 -translate-x-1/2"
    if (position === Position.Left) posClass = "-left-2 top-1/2 -translate-y-1/2"
    if (position === Position.Right) posClass = "-right-2 top-1/2 -translate-y-1/2"

    return (
        <button
            onClick={onClick}
            className={`absolute ${posClass} bg-[var(--bg-panel)] border border-subtle-custom w-4 h-4 rounded-full flex items-center justify-center hover:border-[var(--accent-blue-bright)] hover:text-[var(--accent-blue-bright)] transition-colors z-50 text-secondary-custom cursor-pointer shadow-sm`}
        >
            <span className="text-[12px] leading-none mb-[1px]">+</span>
        </button>
    )
}

const CustomNode = ({ data, id }) => {
    const { label, tag, author, date, type, onAddNode, onTagClick } = data
    const styling = NODE_COLORS[tag] || NODE_COLORS.pending

    const isRoot = type === "new"
    const isEnd = tag === "red"

    // Truncate label to ~50 chars
    const displayLabel = label?.length > 50 ? label.substring(0, 50) + "..." : label

    return (
        <div
            className="rounded-xl border backdrop-blur-md px-4 py-3 min-w-[200px] max-w-[280px] shadow-lg transition-transform hover:scale-105 relative"
            style={{
                backgroundColor: styling.bg,
                borderColor: styling.border,
                boxShadow: `0 4px 20px ${styling.bg}`,
            }}
        >
            {/* Hidden handles for edges to explicitly target - now slightly offset and hoverable so users can draw manual dotted lines */}
            <Handle id="top-target" type="target" position={Position.Top} className="opacity-0 w-3 h-3 cursor-crosshair hover:opacity-100 bg-[var(--accent-blue-bright)] border-none -mt-1.5 transition-opacity" style={{ left: '40%' }} />
            <Handle id="top-source" type="source" position={Position.Top} className="opacity-0 w-3 h-3 cursor-crosshair hover:opacity-100 bg-[var(--semantic-success)] border-none -mt-1.5 transition-opacity" style={{ left: '60%' }} />

            <Handle id="bottom-target" type="target" position={Position.Bottom} className="opacity-0 w-3 h-3 cursor-crosshair hover:opacity-100 bg-[var(--accent-blue-bright)] border-none -mb-1.5 transition-opacity" style={{ left: '40%' }} />
            <Handle id="bottom-source" type="source" position={Position.Bottom} className="opacity-0 w-3 h-3 cursor-crosshair hover:opacity-100 bg-[var(--semantic-success)] border-none -mb-1.5 transition-opacity" style={{ left: '60%' }} />

            <Handle id="left-target" type="target" position={Position.Left} className="opacity-0 w-3 h-3 cursor-crosshair hover:opacity-100 bg-[var(--accent-blue-bright)] border-none -ml-1.5 transition-opacity" style={{ top: '40%' }} />
            <Handle id="left-source" type="source" position={Position.Left} className="opacity-0 w-3 h-3 cursor-crosshair hover:opacity-100 bg-[var(--semantic-success)] border-none -ml-1.5 transition-opacity" style={{ top: '60%' }} />

            <Handle id="right-target" type="target" position={Position.Right} className="opacity-0 w-3 h-3 cursor-crosshair hover:opacity-100 bg-[var(--accent-blue-bright)] border-none -mr-1.5 transition-opacity" style={{ top: '40%' }} />
            <Handle id="right-source" type="source" position={Position.Right} className="opacity-0 w-3 h-3 cursor-crosshair hover:opacity-100 bg-[var(--semantic-success)] border-none -mr-1.5 transition-opacity" style={{ top: '60%' }} />

            {!isRoot && <PlusButton position={Position.Top} onClick={() => onAddNode?.(id, 'top')} />}

            {!isRoot && !isEnd && (
                <>
                    <PlusButton position={Position.Left} onClick={() => onAddNode?.(id, 'left')} />
                    <PlusButton position={Position.Right} onClick={() => onAddNode?.(id, 'right')} />
                </>
            )}

            <div className="flex flex-col gap-2">
                <div className="flex justify-between items-start">
                    <div className="text-xs font-mono font-bold uppercase tracking-widest leading-snug break-words pr-2 text-primary-custom" style={{ wordBreak: 'break-word' }}>
                        {displayLabel}
                    </div>
                    <button
                        onClick={(e) => { e.stopPropagation(); onTagClick?.(id, tag); }}
                        className="flex-shrink-0 text-[9px] px-1.5 py-0.5 rounded font-mono font-bold uppercase border mt-0.5 cursor-pointer hover:scale-105 active:scale-95 transition-transform"
                        style={{ color: styling.text, borderColor: styling.text, backgroundColor: styling.bg }}
                    >
                        {tag}
                    </button>
                </div>

                <div className="flex justify-between items-center text-[10px] font-mono border-t border-subtle-custom pt-2 mt-1">
                    <span className="text-secondary-custom/60 uppercase tracking-widest">{date || "UNKNOWN DATE"}</span>
                    <span className="text-primary-custom/80 uppercase tracking-widest truncate max-w-[100px] text-right">{author}</span>
                </div>
            </div>

            {!isEnd && <PlusButton position={Position.Bottom} onClick={() => onAddNode?.(id, 'bottom')} />}
        </div>
    )
}

const nodeTypes = {
    custom: CustomNode,
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
        return {
            ...node,
            position: {
                x: nodeWithPosition.x - 130, // subtract half width
                y: nodeWithPosition.y - 60,  // subtract half height
            },
        }
    })

    const layoutedEdges = edges.map((edge) => {
        const sourceNode = layoutedNodes.find(n => n.id === edge.source);
        const targetNode = layoutedNodes.find(n => n.id === edge.target);

        if (!sourceNode || !targetNode) return edge;

        const dx = targetNode.position.x - sourceNode.position.x;
        const dy = targetNode.position.y - sourceNode.position.y;

        let sourceHandle = 'bottom-source';
        let targetHandle = 'top-target';

        if (Math.abs(dx) > Math.abs(dy)) {
            // Horizontal connection
            if (dx > 0) {
                sourceHandle = 'right-source';
                targetHandle = 'left-target';
            } else {
                sourceHandle = 'left-source';
                targetHandle = 'right-target';
            }
        } else {
            // Vertical connection
            if (dy > 0) {
                sourceHandle = 'bottom-source';
                targetHandle = 'top-target';
            } else {
                sourceHandle = 'top-source';
                targetHandle = 'bottom-target';
            }
        }

        const isMainBranch = Math.abs(dx) <= Math.abs(dy);

        return {
            ...edge,
            type: 'smoothstep', // Use smoothstep universally for PowerBI-like orthogonal routing
            sourceHandle,
            targetHandle,
            style: {
                stroke: isMainBranch ? 'var(--accent-blue-bright)' : 'var(--secondary-custom)',
                strokeWidth: isMainBranch ? 3 : 2,
                strokeDasharray: isMainBranch ? 'none' : '5 5'
            }
        }
    })

    return { nodes: layoutedNodes, edges: layoutedEdges }
}

// ─── Main Component ────────────────────────────────────────────────

export default function IssueFlowchart({ issueId }) {
    const { user } = useAuth()
    const [nodes, setNodes, onNodesChange] = useNodesState([])
    const [edges, setEdges, onEdgesChange] = useEdgesState([])
    const [isLoading, setIsLoading] = useState(true)

    const [activeTagEdit, setActiveTagEdit] = useState(null)
    const [tagConfirm, setTagConfirm] = useState(null)
    const [confirmText, setConfirmText] = useState("")

    const handleTagClick = useCallback((nodeId, currentTag) => {
        setActiveTagEdit({ nodeId, currentTag })
    }, [])

    const handleConfirmTag = async () => {
        if (confirmText !== "Confirm") {
            toast.error("Validation Failed", { description: "You must type exactly 'Confirm'." })
            return
        }

        try {
            // Optimistic Update
            setNodes(nds => nds.map(n => n.id === tagConfirm.nodeId ? { ...n, data: { ...n.data, tag: tagConfirm.newTag } } : n))
            await api.tagIssueNode(tagConfirm.nodeId, tagConfirm.newTag)
            toast.success("Tag Updated Successfully")
            setTagConfirm(null)
            setConfirmText("")
        } catch (err) {
            toast.error("Update failed", { description: err.message })
            // Refresh graph to revert on failure
            loadGraph()
        }
    }

    const onConnect = useCallback((params) => {
        setEdges((eds) => addEdge({
            ...params,
            type: 'smoothstep',
            animated: true,
            style: {
                stroke: 'var(--secondary-custom)',
                strokeWidth: 2,
                strokeDasharray: '5 5'
            }
        }, eds))
    }, [setEdges])

    const handleAddNode = useCallback((parentId, direction) => {
        setNodes(nds => {
            const parentNode = nds.find(n => n.id === parentId)
            if (!parentNode) return nds

            let newX = parentNode.position.x
            let newY = parentNode.position.y

            let sHandle = 'bottom-source';
            let tHandle = 'top-target';

            // Stagger position based on direction clicked
            if (direction === 'left') {
                newX -= 320;
                sHandle = 'left-source';
                tHandle = 'right-target';
            }
            else if (direction === 'right') {
                newX += 320;
                sHandle = 'right-source';
                tHandle = 'left-target';
            }
            else if (direction === 'bottom') {
                newY += 160;
                sHandle = 'bottom-source';
                tHandle = 'top-target';
            }
            else if (direction === 'top') {
                newY -= 160;
                // Reverse edge: newNode acts as visual parent flowing down into this node
                sHandle = 'bottom-source';
                tHandle = 'top-target';
            }

            const newNodeId = `node_${Date.now()}`
            const authorName = user?.emp_id || user?.email?.split('@')[0] || 'USER'
            const currentDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()

            const newNode = {
                id: newNodeId,
                type: 'custom',
                data: {
                    label: 'NEW ISSUE',
                    tag: 'pending',
                    author: authorName,
                    date: currentDate,
                    type: 'child',
                    onAddNode: null, // assigned below
                    onTagClick: handleTagClick
                },
                position: { x: newX, y: newY }
            }
            newNode.data.onAddNode = handleAddNode

            const isMainBranch = direction === 'bottom' || direction === 'top'
            const isReverse = direction === 'top'

            const newEdge = {
                id: `edge_${parentId}_${newNodeId}`,
                source: isReverse ? newNodeId : parentId,
                target: isReverse ? parentId : newNodeId,
                sourceHandle: sHandle,
                targetHandle: tHandle,
                type: 'smoothstep',
                animated: true,
                style: {
                    stroke: isMainBranch ? 'var(--accent-blue-bright)' : 'var(--secondary-custom)',
                    strokeWidth: isMainBranch ? 3 : 2,
                    strokeDasharray: isMainBranch ? 'none' : '5 5'
                },
            }

            setEdges(eds => [...eds, newEdge])
            return [...nds, newNode]
        })
    }, [user, setEdges, setNodes])

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
                type: 'straight',
                animated: true,
                style: { stroke: 'var(--accent-blue-bright)', strokeWidth: 3 },
            }))

            const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
                initialNodes,
                initialEdges
            )

            setNodes(layoutedNodes)
            setEdges(layoutedEdges)
        } catch (err) {
            toast.error("Failed to load graph", { description: err.message })
        } finally {
            setIsLoading(false)
        }
    }, [issueId, setNodes, setEdges])

    useEffect(() => {
        loadGraph()
    }, [loadGraph])

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
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                minZoom={0.1}
                maxZoom={1.5}
                proOptions={{ hideAttribution: true }}
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

            {/* Editing Modals */}
            <AnimatePresence>
                {activeTagEdit && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] backdrop-blur-xl bg-black/40 flex items-center justify-center p-4"
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
                                            setTagConfirm({ nodeId: activeTagEdit.nodeId, newTag: opt })
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
                        className="fixed inset-0 z-[110] backdrop-blur-xl bg-black/50 flex items-center justify-center p-4"
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
                                className="text-center font-mono border-subtle-custom bg-[var(--bg-root)] focus:border-[var(--accent-blue-bright)]"
                                onKeyDown={e => {
                                    if (e.key === "Enter") handleConfirmTag()
                                }}
                            />

                            <div className="flex gap-4 mt-2">
                                <Button
                                    onClick={() => { setTagConfirm(null); setConfirmText(""); }}
                                    className="flex-1 bg-transparent border border-subtle-custom text-secondary-custom hover:text-white hover:bg-white/5 transition-all"
                                >
                                    CANCEL
                                </Button>
                                <Button
                                    onClick={handleConfirmTag}
                                    className="flex-1 gradient-button text-white font-bold soft-shadow"
                                >
                                    PROCEED
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <style>{`
                .custom-flow-controls {
                    background-color: var(--bg-panel) !important;
                    border: 1px solid var(--subtle-custom) !important;
                    border-radius: 8px !important;
                    overflow: hidden;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.5) !important;
                }
                .custom-flow-controls button {
                    background-color: transparent !important;
                    border-bottom: 1px solid var(--subtle-custom) !important;
                    fill: var(--secondary-custom) !important;
                    transition: all 0.2s;
                }
                .custom-flow-controls button:last-child {
                    border-bottom: none !important;
                }
                .custom-flow-controls button:hover {
                    background-color: var(--surface-custom) !important;
                    fill: var(--accent-blue-bright) !important;
                }
            `}</style>
        </motion.div>
    )
}
