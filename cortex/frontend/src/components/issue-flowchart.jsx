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

// ─── Custom Node Configurations ────────────────────────────────────

const NODE_COLORS = {
    pending: { bg: "rgba(142, 142, 147, 0.1)", border: "#8e8e93", text: "#8e8e93" },
    yellow: { bg: "rgba(255, 204, 0, 0.15)", border: "#ffcc00", text: "#e6b800" },
    blue: { bg: "rgba(0, 191, 255, 0.15)", border: "#00bfff", text: "#00bfff" },
    green: { bg: "rgba(52, 199, 89, 0.15)", border: "#34c759", text: "#34c759" },
    red: { bg: "rgba(255, 59, 48, 0.15)", border: "#ff3b30", text: "#ff3b30" },
}

const CustomNode = ({ data }) => {
    const { label, tag, author, description, type } = data
    const styling = NODE_COLORS[tag] || NODE_COLORS.pending

    return (
        <div
            className="rounded-xl border backdrop-blur-md px-4 py-3 min-w-[200px] max-w-[280px] shadow-lg transition-transform hover:scale-105"
            style={{
                backgroundColor: styling.bg,
                borderColor: styling.border,
                boxShadow: `0 4px 20px ${styling.bg}`,
            }}
        >
            <Handle type="target" position={Position.Top} className="!bg-secondary-custom !w-3 !h-3" />

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

            <Handle type="source" position={Position.Bottom} className="!bg-secondary-custom !w-3 !h-3" />
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

    const loadGraph = useCallback(async () => {
        if (!issueId) return
        setIsLoading(true)
        try {
            const data = await api.getIssueGraph(issueId)

            // Map backend data to React Flow format
            const initialNodes = data.nodes.map(n => ({
                id: n.id,
                type: 'custom',
                data: { ...n.data },
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
            <div className="w-full h-full flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-[var(--accent-blue-bright)] border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    if (!nodes.length) {
        return (
            <div className="w-full h-full flex items-center justify-center text-secondary-custom font-mono">
                GRAPH DATA UNAVAILABLE
            </div>
        )
    }

    return (
        <motion.div {...FADE_IN} className="w-full h-full relative" style={{ background: "var(--bg-root)" }}>
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
                attributionPosition="bottom-right"
            >
                <Background color="#333" gap={16} />
                <Controls className="!bg-surface-custom !border-subtle-custom !fill-primary-custom" />
                <MiniMap
                    className="!bg-surface-custom !border-subtle-custom"
                    maskColor="rgba(0, 0, 0, 0.7)"
                    nodeColor={(n) => NODE_COLORS[n.data?.tag]?.border || "#8e8e93"}
                />
            </ReactFlow>

            {/* Top-right floating indicator */}
            <div className="absolute top-4 right-4 bg-surface-custom/80 backdrop-blur border border-subtle-custom px-4 py-2 rounded-lg pointer-events-none z-10 shadow-lg">
                <div className="text-xs font-mono text-primary-custom font-bold">DAG: {issueId}</div>
                <div className="text-[10px] font-mono text-secondary-custom">Execution Ledger Graph</div>
            </div>
        </motion.div>
    )
}
