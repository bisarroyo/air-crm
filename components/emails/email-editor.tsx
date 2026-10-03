'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import TextAlign from '@tiptap/extension-text-align'
import {
    AlignCenter,
    AlignLeft,
    AlignRight,
    Bold,
    ChevronDown,
    ImageIcon,
    Italic,
    Link2,
    List,
    ListOrdered,
    Quote,
    Redo2,
    Strikethrough,
    UnderlineIcon,
    Undo2,
    Unlink
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger
} from '@/components/ui/select'
import { TEMPLATE_VARIABLES } from '@/lib/email/template'

const TEXT_COLORS = [
    { label: 'Negro', value: '#111827' },
    { label: 'Gris', value: '#6B7280' },
    { label: 'Verde CRM', value: '#0F766E' },
    { label: 'Verde oscuro', value: '#134E4A' },
    { label: 'Rojo', value: '#DC2626' },
    { label: 'Azul', value: '#2563EB' }
]

function ToolButton({
    onClick,
    active,
    disabled,
    title,
    children
}: {
    onClick: () => void
    active?: boolean
    disabled?: boolean
    title: string
    children: React.ReactNode
}) {
    return (
        <Button
            type='button'
            variant={active ? 'secondary' : 'ghost'}
            size='icon-sm'
            disabled={disabled}
            title={title}
            aria-label={title}
            onClick={onClick}>
            {children}
        </Button>
    )
}

function VariablesMenu({
    onInsert,
    label = 'Insertar variable'
}: {
    onInsert: (token: string) => void
    label?: string
}) {
    const groups = ['Cliente', 'CRM'] as const

    return (
        <Select
            value={null}
            onValueChange={(value) => {
                if (value) onInsert(value)
            }}>
            <SelectTrigger
                size='sm'
                className='w-[170px]'
                title={label}>
                <span className='flex items-center gap-1'>
                    {label}
                    <ChevronDown className='size-3.5 opacity-60' />
                </span>
            </SelectTrigger>
            <SelectContent>
                {groups.map((group) => (
                    <SelectGroup key={group}>
                        <SelectLabel>{group}</SelectLabel>
                        {TEMPLATE_VARIABLES.filter(
                            (variable) => variable.group === group
                        ).map((variable) => (
                            <SelectItem
                                key={variable.token}
                                value={variable.token}>
                                {variable.token} · {variable.label}
                            </SelectItem>
                        ))}
                    </SelectGroup>
                ))}
            </SelectContent>
        </Select>
    )
}

/**
 * Editor visual del correo (TipTap). Produce el mismo HTML que se recibe al
 * pegar código a mano, y añade el menú de variables {{...}} que inserta el
 * token en el punto del cursor.
 */
export function EmailEditor({
    value,
    onChange,
    onImageUploaded
}: {
    value: string
    onChange: (html: string) => void
    onImageUploaded?: () => void
}) {
    const router = useRouter()
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [uploading, setUploading] = useState(false)
    const [cloudinary, setCloudinary] = useState<boolean | null>(null)
    const [showLinkInput, setShowLinkInput] = useState(false)
    const [linkValue, setLinkValue] = useState('')

    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3] },
                codeBlock: false,
                horizontalRule: false
            }),
            Image.configure({
                allowBase64: false,
                HTMLAttributes: { style: 'max-width:100%;height:auto;' }
            }),
            Link.configure({
                openOnClick: false,
                autolink: true,
                HTMLAttributes: { rel: 'noopener noreferrer' }
            }),
            Placeholder.configure({
                placeholder:
                    'Escribe aquí el mensaje. Usa el botón de variables para insertar datos del cliente.'
            }),
            TextStyle,
            Color,
            TextAlign.configure({ types: ['heading', 'paragraph'] })
        ],
        content: value,
        editorProps: {
            attributes: {
                className:
                    'min-h-[320px] px-3 py-2 text-[15px] leading-relaxed outline-none text-gray-900'
            }
        },
        onUpdate: ({ editor: instance }) => {
            onChange(instance.getHTML())
        }
    })

    // Sincroniza cambios externos del contenido (por ejemplo al aplicar una
    // plantilla): `useEditor` solo lee `value` al crearse, así que sin esto el
    // cuadro seguía mostrando el mensaje anterior.
    useEffect(() => {
        if (!editor) return
        if (editor.getHTML() === value) return
        editor.commands.setContent(value, { emitUpdate: false })
    }, [editor, value])

    // Cloudinary es opcional: si no está configurado se esconde "Subir imagen"
    // y solo queda pegar una URL.
    const checkCloudinary = useCallback(async () => {
        if (cloudinary !== null) return
        try {
            const response = await fetch('/api/emails/status')
            const payload = (await response.json()) as {
                cloudinaryConfigured?: boolean
            }
            setCloudinary(Boolean(payload.cloudinaryConfigured))
        } catch {
            setCloudinary(false)
        }
    }, [cloudinary])

    if (cloudinary === null) {
        void checkCloudinary()
    }

    const insertVariable = (token: string) => {
        if (!editor) return
        editor
        .chain()
        .focus()
        .insertContent(
            `${token} `
        )
        .run()
    }

    const applyLink = () => {
        if (!editor) return
        const url = linkValue.trim()
        if (!url) {
            editor.chain().focus().extendMarkRange('link').unsetLink().run()
        } else {
            const href = /^https?:\/\//i.test(url) ? url : `https://${url}`
            editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
        }
        setLinkValue('')
        setShowLinkInput(false)
    }

    const uploadImage = async (file: File) => {
        setUploading(true)
        try {
            const form = new FormData()
            form.append('file', file)

            const response = await fetch('/api/emails/upload', {
                method: 'POST',
                body: form
            })
            const payload = (await response.json()) as {
                url?: string
                error?: string
            }

            if (!response.ok || !payload.url) {
                toast.error(payload.error || 'No se pudo subir la imagen')
                return
            }

            editor?.chain().focus().setImage({ src: payload.url }).run()
            onImageUploaded?.()
            toast.success('Imagen subida')
            router.refresh()
        } catch {
            toast.error('No se pudo subir la imagen')
        } finally {
            setUploading(false)
        }
    }

    if (!editor) {
        return (
            <div className='text-muted-foreground min-h-[320px] rounded-md border p-3 text-sm'>
                Cargando editor…
            </div>
        )
    }

    return (
        <div className='overflow-hidden rounded-md border'>
            <div className='bg-muted/40 flex flex-wrap items-center gap-0.5 border-b p-1'>
                <VariablesMenu onInsert={insertVariable} />

                <div className='bg-border mx-1 h-5 w-px' />

                <ToolButton
                    title='Deshacer'
                    disabled={!editor.can().undo()}
                    onClick={() => editor.chain().focus().undo().run()}>
                    <Undo2 />
                </ToolButton>
                <ToolButton
                    title='Rehacer'
                    disabled={!editor.can().redo()}
                    onClick={() => editor.chain().focus().redo().run()}>
                    <Redo2 />
                </ToolButton>

                <div className='bg-border mx-1 h-5 w-px' />

                <ToolButton
                    title='Negrita'
                    active={editor.isActive('bold')}
                    onClick={() => editor.chain().focus().toggleBold().run()}>
                    <Bold />
                </ToolButton>
                <ToolButton
                    title='Cursiva'
                    active={editor.isActive('italic')}
                    onClick={() =>
                        editor.chain().focus().toggleItalic().run()
                    }>
                    <Italic />
                </ToolButton>
                <ToolButton
                    title='Subrayado'
                    active={editor.isActive('underline')}
                    onClick={() =>
                        editor.chain().focus().toggleUnderline().run()
                    }>
                    <UnderlineIcon />
                </ToolButton>
                <ToolButton
                    title='Tachado'
                    active={editor.isActive('strike')}
                    onClick={() =>
                        editor.chain().focus().toggleStrike().run()
                    }>
                    <Strikethrough />
                </ToolButton>

                <Select
                    value={editor.getAttributes('textStyle').color || '#111827'}
                    onValueChange={(color) =>
                        editor.chain().focus().setColor(color).run()
                    }>
                    <SelectTrigger
                        size='sm'
                        className='w-[110px]'
                        title='Color del texto'>
                        <span className='flex items-center gap-1.5'>
                            <span
                                className='size-3 rounded-sm border'
                                style={{
                                    backgroundColor:
                                        editor.getAttributes('textStyle')
                                            .color || '#111827'
                                }}
                            />
                            Color
                        </span>
                    </SelectTrigger>
                    <SelectContent>
                        {TEXT_COLORS.map((color) => (
                            <SelectItem
                                key={color.value}
                                value={color.value}>
                                <span className='flex items-center gap-2'>
                                    <span
                                        className='size-3 rounded-sm border'
                                        style={{ backgroundColor: color.value }}
                                    />
                                    {color.label}
                                </span>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <div className='bg-border mx-1 h-5 w-px' />

                <Select
                    value={
                        editor.isActive('heading', { level: 1 })
                            ? 'h1'
                            : editor.isActive('heading', { level: 2 })
                              ? 'h2'
                              : editor.isActive('heading', { level: 3 })
                                ? 'h3'
                                : 'p'
                    }
                    onValueChange={(value) => {
                        if (value === 'p') {
                            editor.chain().focus().setParagraph().run()
                            return
                        }
                        const level = Number((value || 'p').replace('h', ''))
                        editor
                            .chain()
                            .focus()
                            .toggleHeading({ level: level as 1 | 2 | 3 })
                            .run()
                    }}>
                    <SelectTrigger size='sm' className='w-[110px]'>
                        {editor.isActive('heading', { level: 1 })
                            ? 'Título'
                            : editor.isActive('heading', { level: 2 })
                              ? 'Subtítulo'
                              : editor.isActive('heading', { level: 3 })
                                ? 'Subtítulo 3'
                                : 'Párrafo'}
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value='p'>Párrafo</SelectItem>
                        <SelectItem value='h1'>Título</SelectItem>
                        <SelectItem value='h2'>Subtítulo</SelectItem>
                        <SelectItem value='h3'>Subtítulo 3</SelectItem>
                    </SelectContent>
                </Select>

                <ToolButton
                    title='Alinear a la izquierda'
                    active={editor.isActive({ textAlign: 'left' })}
                    onClick={() =>
                        editor.chain().focus().setTextAlign('left').run()
                    }>
                    <AlignLeft />
                </ToolButton>
                <ToolButton
                    title='Centrar'
                    active={editor.isActive({ textAlign: 'center' })}
                    onClick={() =>
                        editor.chain().focus().setTextAlign('center').run()
                    }>
                    <AlignCenter />
                </ToolButton>
                <ToolButton
                    title='Alinear a la derecha'
                    active={editor.isActive({ textAlign: 'right' })}
                    onClick={() =>
                        editor.chain().focus().setTextAlign('right').run()
                    }>
                    <AlignRight />
                </ToolButton>

                <div className='bg-border mx-1 h-5 w-px' />

                <ToolButton
                    title='Lista con viñetas'
                    active={editor.isActive('bulletList')}
                    onClick={() =>
                        editor.chain().focus().toggleBulletList().run()
                    }>
                    <List />
                </ToolButton>
                <ToolButton
                    title='Lista numerada'
                    active={editor.isActive('orderedList')}
                    onClick={() =>
                        editor.chain().focus().toggleOrderedList().run()
                    }>
                    <ListOrdered />
                </ToolButton>
                <ToolButton
                    title='Cita'
                    active={editor.isActive('blockquote')}
                    onClick={() =>
                        editor.chain().focus().toggleBlockquote().run()
                    }>
                    <Quote />
                </ToolButton>

                <div className='bg-border mx-1 h-5 w-px' />

                <ToolButton
                    title='Agregar o editar enlace'
                    active={editor.isActive('link')}
                    onClick={() => {
                        setLinkValue(
                            editor.getAttributes('link').href || ''
                        )
                        setShowLinkInput((prev) => !prev)
                    }}>
                    <Link2 />
                </ToolButton>
                {editor.isActive('link') && (
                    <ToolButton
                        title='Quitar enlace'
                        onClick={() => editor.chain().focus().unsetLink().run()}>
                        <Unlink />
                    </ToolButton>
                )}

                <ToolButton
                    title='Insertar imagen por URL'
                    onClick={() => {
                        const url = window.prompt('URL de la imagen')
                        if (!url) return
                        editor.chain().focus().setImage({ src: url }).run()
                    }}>
                    <ImageIcon />
                </ToolButton>

                {cloudinary && (
                    <>
                        <ToolButton
                            title={
                                uploading ? 'Subiendo…' : 'Subir imagen'
                            }
                            disabled={uploading}
                            onClick={() => fileInputRef.current?.click()}>
                            <ImageIcon className='text-primary' />
                        </ToolButton>
                        <input
                            ref={fileInputRef}
                            type='file'
                            accept='image/png,image/jpeg,image/gif,image/webp'
                            className='hidden'
                            onChange={(event) => {
                                const file = event.target.files?.[0]
                                if (file) void uploadImage(file)
                                event.target.value = ''
                            }}
                        />
                    </>
                )}
            </div>

            {showLinkInput && (
                <div className='flex items-center gap-2 border-b px-2 py-1.5'>
                    <Input
                        value={linkValue}
                        placeholder='https://ejemplo.com'
                        className='h-8'
                        onChange={(event) => setLinkValue(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                event.preventDefault()
                                applyLink()
                            }
                            if (event.key === 'Escape') setShowLinkInput(false)
                        }}
                    />
                    <Button
                        type='button'
                        size='sm'
                        variant='secondary'
                        onClick={applyLink}>
                        Aplicar
                    </Button>
                    <Button
                        type='button'
                        size='sm'
                        variant='ghost'
                        onClick={() => setShowLinkInput(false)}>
                        Cancelar
                    </Button>
                </div>
            )}

            <EditorContent editor={editor} />
        </div>
    )
}