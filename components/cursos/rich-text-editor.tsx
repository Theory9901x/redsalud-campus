"use client";

import { useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { Node, mergeAttributes } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Link2,
  Image as ImageIcon,
  MonitorPlay,
  Undo,
  Redo,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getYoutubeEmbedUrl } from "@/lib/youtube";
import { hostEmbebidoPermitido } from "@/lib/html-seguro";

/**
 * Nodo EMBEBIDO: un iframe responsivo (Genially, Canva, Google Slides,
 * YouTube, Vimeo, Office, Padlet...). Se guarda como
 * <div data-embebido><iframe src=...></iframe></div> y el sanitizador del
 * servidor deja pasar solo los dominios de la lista blanca.
 */
const Embebido = Node.create({
  name: "embebido",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return { src: { default: null } };
  },
  parseHTML() {
    return [
      {
        tag: "div[data-embebido]",
        getAttrs: (el) => ({ src: (el as HTMLElement).querySelector("iframe")?.getAttribute("src") ?? null }),
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      { "data-embebido": "", class: "embebido" },
      [
        "iframe",
        mergeAttributes({
          src: HTMLAttributes.src,
          allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen",
          allowfullscreen: "true",
          frameborder: "0",
          title: "Contenido embebido",
        }),
      ],
    ];
  },
});

/** Imagen por URL (la carga de archivos va aparte, en la lección tipo Imagen). */
const Imagen = Node.create({
  name: "imagen",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return { src: { default: null }, alt: { default: "" } };
  },
  parseHTML() {
    return [{ tag: "img[src]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["img", mergeAttributes(HTMLAttributes, { class: "imagen-contenido" })];
  },
});

/**
 * Normaliza lo que el tutor pega: un enlace de YouTube "watch" pasa a
 * "embed"; un codigo <iframe ...> completo (el que copian de Genially o
 * Canva) se reduce a su src. Devuelve null si no es embebible.
 */
function normalizarEmbebido(entrada: string): string | null {
  const texto = entrada.trim();
  const iframeSrc = texto.match(/<iframe[^>]*\ssrc=["']([^"']+)["']/i)?.[1];
  const url = iframeSrc ?? texto;
  const youtube = getYoutubeEmbedUrl(url);
  if (youtube) return youtube;
  return hostEmbebidoPermitido(url) ? url : null;
}

export function RichTextEditor({
  name,
  defaultValue,
}: {
  name: string;
  defaultValue?: string;
}) {
  const [html, setHtml] = useState(defaultValue || "");

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: false, underline: false, heading: { levels: [2, 3] } }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true, defaultProtocol: "https" }),
      Embebido,
      Imagen,
    ],
    content: defaultValue || "",
    immediatelyRender: false,
    onUpdate: ({ editor }) => setHtml(editor.getHTML()),
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none min-h-[200px] rounded-b-md border border-t-0 border-input bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring",
      },
    },
  });

  if (!editor) {
    return <div className="h-[240px] animate-pulse rounded-md border border-input bg-muted" />;
  }

  function insertarEnlace() {
    const actual = editor!.getAttributes("link").href as string | undefined;
    const url = window.prompt("Dirección del enlace (https://...)", actual ?? "https://");
    if (url === null) return;
    if (url.trim() === "" || url.trim() === "https://") {
      editor!.chain().focus().unsetLink().run();
      return;
    }
    editor!.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  }

  function insertarEmbebido() {
    const entrada = window.prompt(
      "Pega el enlace o el código <iframe> del contenido (YouTube, Genially, Canva, Google Slides, Vimeo, Office, Padlet...)"
    );
    if (!entrada) return;
    const src = normalizarEmbebido(entrada);
    if (!src) {
      window.alert(
        "Ese proveedor no está en la lista de embebidos permitidos. Usa YouTube, Vimeo, Genially, Canva, Google Docs/Slides/Drive, Office, Padlet, Prezi, Wordwall, Educaplay, H5P o Mentimeter."
      );
      return;
    }
    editor!.chain().focus().insertContent({ type: "embebido", attrs: { src } }).run();
  }

  function insertarImagen() {
    const src = window.prompt("Dirección de la imagen (https://...)");
    if (!src) return;
    const alt = window.prompt("Texto alternativo (describe la imagen)", "") ?? "";
    editor!.chain().focus().insertContent({ type: "imagen", attrs: { src: src.trim(), alt } }).run();
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1 rounded-t-md border border-input bg-muted/40 p-1">
        <ToolbarButton title="Negrita" onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")}>
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="Cursiva" onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")}>
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="Subrayado" onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")}>
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarButton>
        <div className="mx-1 h-4 w-px bg-border" />
        <ToolbarButton
          title="Título"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive("heading", { level: 2 })}
        >
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Subtítulo"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive("heading", { level: 3 })}
        >
          <Heading3 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="Lista" onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")}>
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="Lista numerada" onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")}>
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="Cita" onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")}>
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        <div className="mx-1 h-4 w-px bg-border" />
        <ToolbarButton title="Enlace" onClick={insertarEnlace} active={editor.isActive("link")}>
          <Link2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="Imagen por URL" onClick={insertarImagen}>
          <ImageIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="Insertar embebido (YouTube, Genially, Canva, Google Slides...)" onClick={insertarEmbebido}>
          <MonitorPlay className="h-4 w-4" />
        </ToolbarButton>
        <div className="mx-1 h-4 w-px bg-border" />
        <ToolbarButton title="Deshacer" onClick={() => editor.chain().focus().undo().run()}>
          <Undo className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton title="Rehacer" onClick={() => editor.chain().focus().redo().run()}>
          <Redo className="h-4 w-4" />
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} />
      <input type="hidden" name={name} value={html} readOnly />
    </div>
  );
}

function ToolbarButton({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={cn(active && "bg-accent text-accent-foreground")}
    >
      {children}
    </Button>
  );
}
