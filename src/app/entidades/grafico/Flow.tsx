"use client";
import Dagre from "@dagrejs/dagre";
import { useMemo, type FC } from "react";
import ReactFlow, {
  Background,
  Controls,
  type Edge,
  type Node,
} from "reactflow";
import "reactflow/dist/style.css";
import { findColor } from "~/lib/functions";
import { type RouterOutputs } from "~/trpc/shared";
import EntityNode from "./EntityNode";
import TagNode from "./TagNode";

interface FlowProps {
  initialTags: RouterOutputs["tags"]["getAll"];
  initialEntities: RouterOutputs["entities"]["getAll"];
}

const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));

// @ts-ignore
const getLayoutedElements = (nodes, edges) => {
  g.setGraph({ rankdir: "TB", nodesep: 300, ranksep: 150 });

  // @ts-ignore
  edges.forEach((edge) => g.setEdge(edge.source, edge.target));
  // @ts-ignore
  nodes.forEach((node) => g.setNode(node.id, node));

  Dagre.layout(g);

  return {
    // @ts-ignore
    nodes: nodes.map((node) => {
      const { x, y } = g.node(node.id);

      return { ...node, position: { x, y } };
    }),
    edges,
  };
};

const Flow: FC<FlowProps> = ({ initialTags, initialEntities }) => {
  const nodeTags: Node<(typeof initialTags)[number], "tag">[] = initialTags.map(
    (tag) => {
      return {
        id: tag.name,
        position: { x: 0, y: 0 },
        data: {
          ...tag,
          color: findColor(tag, initialTags),
        },
        type: "tag",
      };
    },
  );

  const nodeEntities: Node<(typeof initialEntities)[number], "entity">[] =
    initialEntities.map((entity) => {
      return {
        id: entity.name,
        position: { x: 0, y: 0 },
        data: {
          ...entity,
          tag: { ...entity.tag, color: findColor(entity.tag, initialTags) },
        },
        type: "entity",
      };
    });

  const transformTagsToEdges = (tagsData: typeof initialTags): Edge[] => {
    const edges: Edge[] = [];

    for (const tag of tagsData) {
      if (tag.parent) {
        edges.push({
          id: `e${tag.parent}-${tag.name}`,
          source: tag.parent,
          target: tag.name,
          animated: true,
        });
      }
    }

    return edges;
  };

  const transformEntitiesToEdges = (
    entitiesData: typeof initialEntities,
  ): Edge[] => {
    const edges: Edge[] = [];

    for (const entity of entitiesData) {
      edges.push({
        id: `e${entity.id}`,
        source: entity.tag.name,
        target: entity.name,
        animated: true,
      });
    }

    return edges;
  };

  const edgeTags = transformTagsToEdges(initialTags);
  const edgeEntities = transformEntitiesToEdges(initialEntities);

  const layouted = getLayoutedElements(
    [...nodeTags, ...nodeEntities],
    [...edgeTags, ...edgeEntities],
  );
  const nodeTypes = useMemo(() => ({ tag: TagNode, entity: EntityNode }), []);

  return (
    <ReactFlow
      proOptions={{ hideAttribution: true }}
      nodes={layouted.nodes.slice(0, 10)}
      edges={layouted.edges.slice(0, 50)}
      nodeTypes={nodeTypes}
      className="bg-teal-50"
      fitView
    >
      <Background />
      <Controls />
    </ReactFlow>
  );
};

export default Flow;
