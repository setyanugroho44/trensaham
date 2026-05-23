import { useEffect, useRef } from "react";
import { Bold, Italic, Heading2, List, ListOrdered, Link as LinkIcon, Image as ImageIcon, Undo2, Redo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
};

export function RichEditor({ value, onChange, placeholder, className }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  // Sync external value when it changes and editor is not focused
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement === el) return;
    if (el.innerHTML !== value) el.innerHTML = value || "";
  }, [value]);

  const exec = (cmd: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false, arg);
    if (ref.current) onChange(ref.current.innerHTML);
  };

  const addLink = () => {
    const url = window.prompt("URL link (https://…)");
    if (!url) return;
    exec("createLink", url);
  };

  const addImage = () => {
    const url = window.prompt("URL gambar (https://…)");
    if (!url) return;
    exec("insertImage", url);
  };

  return (
    <div className={cn("rounded-md border bg-background", className)}>
      <div className="flex flex-wrap items-center gap-1 border-b p-1">
        <ToolBtn onClick={() => exec("bold")} title="Bold (Ctrl+B)"><Bold className="h-4 w-4" /></ToolBtn>
        <ToolBtn onClick={() => exec("italic")} title="Italic"><Italic className="h-4 w-4" /></ToolBtn>
        <ToolBtn onClick={() => exec("formatBlock", "<h2>")} title="Sub-heading"><Heading2 className="h-4 w-4" /></ToolBtn>
        <ToolBtn onClick={() => exec("insertUnorderedList")} title="Bullet list"><List className="h-4 w-4" /></ToolBtn>
        <ToolBtn onClick={() => exec("insertOrderedList")} title="Numbered list"><ListOrdered className="h-4 w-4" /></ToolBtn>
        <ToolBtn onClick={addLink} title="Tautan"><LinkIcon className="h-4 w-4" /></ToolBtn>
        <ToolBtn onClick={addImage} title="Gambar"><ImageIcon className="h-4 w-4" /></ToolBtn>
        <div className="mx-1 h-5 w-px bg-border" />
        <ToolBtn onClick={() => exec("undo")} title="Undo"><Undo2 className="h-4 w-4" /></ToolBtn>
        <ToolBtn onClick={() => exec("redo")} title="Redo"><Redo2 className="h-4 w-4" /></ToolBtn>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder ?? "Tulis di sini…"}
        onInput={(e) => onChange((e.target as HTMLDivElement).innerHTML)}
        className="prose prose-sm dark:prose-invert max-w-none min-h-[160px] p-3 outline-none [&[contenteditable=true]:empty]:before:content-[attr(data-placeholder)] [&[contenteditable=true]:empty]:before:text-muted-foreground"
      />
    </div>
  );
}

function ToolBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" title={title} onMouseDown={(e) => e.preventDefault()} onClick={onClick}>
      {children}
    </Button>
  );
}
