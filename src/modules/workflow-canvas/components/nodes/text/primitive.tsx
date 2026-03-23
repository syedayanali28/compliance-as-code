import type { Editor, EditorEvents } from "@tiptap/core";
import { useReactFlow } from "@xyflow/react";
import { useRef } from "react";
import { EditorProvider } from "@/modules/workflow-canvas/components/kibo-ui/editor";
import { cn } from "@/modules/workflow-canvas/lib/utils";
import { NodeLayout } from "../layout";
import type { TextNodeProps } from ".";

type TextPrimitiveProps = TextNodeProps & {
  title: string;
};

export const TextPrimitive = ({
  data,
  id,
  type,
  title,
}: TextPrimitiveProps) => {
  const { updateNodeData } = useReactFlow();
  const editor = useRef<Editor | null>(null);

  const handleUpdate = ({ editor: editorInstance }: { editor: Editor }) => {
    const json = editorInstance.getJSON();
    const text = editorInstance.getText();

    updateNodeData(id, { content: json, text });
  };

  const handleCreate = (props: EditorEvents["create"]) => {
    editor.current = props.editor;
    props.editor.chain().focus().run();
  };

  return (
    <NodeLayout className="p-0" data={data} id={id} title={title} type={type}>
      <div className="nowheel h-full max-h-[15rem] overflow-auto rounded-xl">
        <EditorProvider
          className={cn(
            "prose prose-sm dark:prose-invert size-full max-w-none p-3 [&_.ProseMirror]:!text-[10.5px] [&_.ProseMirror]:!leading-snug",
            "[&_p:first-child]:mt-0",
            "[&_p:last-child]:mb-0"
          )}
          content={data.content}
          immediatelyRender={false}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
          placeholder="Start typing..."
        />
      </div>
    </NodeLayout>
  );
};

