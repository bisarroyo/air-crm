declare module 'pdfmake' {
    type AnyObject = Record<string, unknown>

    interface PdfMakeDocument {
        getBuffer(): Promise<Buffer>
    }

    interface PdfMakeInstance {
        virtualfs: {
            writeFileSync(
                filename: string,
                content: string,
                options?: string | AnyObject
            ): void
        }
        setFonts(fonts: Record<string, unknown>): void
        createPdf(docDefinition: AnyObject, options?: AnyObject): PdfMakeDocument
    }

    const pdfmake: PdfMakeInstance
    export default pdfmake
}

declare module 'pdfmake/build/vfs_fonts' {
    const vfs: Record<string, string>
    export default vfs
}