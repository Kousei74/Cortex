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
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import dagre from "dagre"
import { api } from "@/lib/api"
import { motion } from "framer-motion"
import { FADE_IN } from "@/lib/animations"
import { toast } from "sonner"
import { CortexLoader } from "./cortex-loader"

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
    const { label, tag, author, description, type, onAddNode } = data
    const styling = NODE_COLORS[tag] || NODE_COLORS.pending

    const isRoot = type === "new"
    const isEnd = tag === "red"

    return (
        <div
            className="rounded-xl border backdrop-blur-md px-4 py-3 min-w-[200px] max-w-[280px] shadow-lg transition-transform hover:scale-105 relative"
            style={{
                backgroundColor: styling.bg,
                borderColor: styling.border,
                boxShadow: `0 4px 20px ${styling.bg}`,
            }}
        >
            {/* Hidden handles for edges to explicitly target */}
            <Handle type="target" position={Position.Top} className="opacity-0 w-1 h-1" />
            <Handle type="source" position={Position.Bottom} className="opacity-0 w-1 h-1" />
            <Handle type="source" position={Position.Left} className="opacity-0 w-1 h-1" />
            <Handle type="source" position={Position.Right} className="opacity-0 w-1 h-1" />

            {!isRoot && <PlusButton position={Position.Top} onClick={() => onAddNode?.(id, 'top')} />}

            {!isRoot && !isEnd && (
                <>
                    <PlusButton position={Position.Left} onClick={() => onAddNode?.(id, 'left')} />
                    <PlusButton position={Position.Right} onClick={() => onAddNode?.(id, 'right')} />
                </>
            )}

            <div className="flex justify-between items-start mb-2">
                <div className="text-xs font-mono font-bold uppercase tracking-widest break-words pr-2 text-primary-custom">
                    {label}
                </div>
                <div
                    className="flex-shrink-0 text-[9px] px-1.5 py-0.5 rounded font-mono font-bold uppercase border"
                    style={{ color: styling.text, borderColor: styling.text }}
                >
                    {tag}
                </div>
            </div>

            <div className="text-[10px] font-mono text-secondary-custom mb-3 line-clamp-3">
                {description}
            </div>

            <div className="flex justify-between items-center text-[10px] font-mono border-t border-subtle-custom pt-2">
                <span className="text-secondary-custom/60 uppercase">{type === "new" ? "ROOT" : "NODE"}</span>
                <span className="text-primary-custom/80 uppercase tracking-widest">{author}</span>
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

    return { nodes: layoutedNodes, edges }
}

// ─── Main Component ────────────────────────────────────────────────

export default function IssueFlowchart({ issueId }) {
    const [nodes, setNodes, onNodesChange] = useNodesState([])
    const [edges, setEdges, onEdgesChange] = useEdgesState([])
    const [isLoading, setIsLoading] = useState(true)

    const handleAddNode = useCallback((parentId, direction) => {
        const newNodeId = `node_${Date.now()}`
        const newNode = {
            id: newNodeId,
            type: 'custom',
            data: {
                label: 'NEW ISSUE',
                tag: 'pending',
                author: 'USER',
                description: 'Draft issue generated for branch extending.',
                type: 'child',
                onAddNode: handleAddNode,
            },
            position: { x: 0, y: 0 }
        }

        const newEdge = {
            id: `edge_${parentId}_${newNodeId}`,
            source: parentId,
            target: newNodeId,
            type: 'smoothstep',
            animated: true,
            style: { stroke: 'var(--accent-blue-bright)', strokeWidth: 2 },
        }

        setNodes(nds => {
            const nextNodes = [...nds, newNode]
            setEdges(eds => {
                const nextEdges = [...eds, newEdge]
                const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(nextNodes, nextEdges)

                // Set the layouted elements in the next tick to overwrite the state properly
                setTimeout(() => {
                    setNodes(layoutedNodes)
                    setEdges(layoutedEdges)
                }, 0)

                return nextEdges
            })
            return nextNodes
        })
    }, [setNodes, setEdges])

    const loadGraph = useCallback(async () => {
        if (!issueId) return
        setIsLoading(true)
        try {
            const data = await api.getIssueGraph(issueId)

            // Map backend data to React Flow format
            const initialNodes = data.nodes.map(n => ({
                id: n.id,
                type: 'custom',
                data: { ...n.data, onAddNode: handleAddNode },
                position: { x: 0, y: 0 }, // Handled by dagre
            }))

            const initialEdges = data.edges.map(e => ({
                id: e.id,
                source: e.source,
                target: e.target,
                type: 'smoothstep',
                animated: true,
                style: { stroke: 'var(--accent-blue-bright)', strokeWidth: 2 },
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
