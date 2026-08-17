'use client'

import { useState, useCallback, useEffect } from 'react'
import { Upload, X, FileText, Image as ImageIcon, Presentation, File, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject, listAll } from 'firebase/storage'
import { getApp } from 'firebase/app'
import { useAuth } from '@/lib/auth-context'
import { useWeek } from '@/lib/week-context'

type UploadedFile = {
  name: string
  url: string
  type: string
  path: string
}

const ACCEPTED = '.png,.jpg,.jpeg,.gif,.webp,.svg,.pdf,.pptx,.ppt,.docx,.doc,.xlsx,.xls'

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml']

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return <ImageIcon className="h-4 w-4" />
  if (['pptx', 'ppt'].includes(ext)) return <Presentation className="h-4 w-4" />
  if (['pdf'].includes(ext)) return <FileText className="h-4 w-4" />
  if (['docx', 'doc'].includes(ext)) return <FileText className="h-4 w-4" />
  return <File className="h-4 w-4" />
}

function isImage(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)
}

type Props = {
  sectionKey: string
}

export function FileUploadGallery({ sectionKey }: Props) {
  const { user } = useAuth()
  const { weekStart } = useWeek()
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)

  const storagePath = `uploads/${sectionKey}/${weekStart}`

  // Load existing files
  const loadFiles = useCallback(async () => {
    try {
      const storage = getStorage(getApp())
      const folderRef = ref(storage, storagePath)
      const result = await listAll(folderRef)
      const fileList: UploadedFile[] = []
      for (const item of result.items) {
        const url = await getDownloadURL(item)
        fileList.push({ name: item.name, url, type: '', path: item.fullPath })
      }
      setFiles(fileList)
    } catch (e) {
      // Folder might not exist yet
      setFiles([])
    }
    setLoading(false)
  }, [storagePath])

  useEffect(() => { loadFiles() }, [loadFiles])

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files
    if (!selectedFiles || selectedFiles.length === 0) return

    setUploading(true)
    const storage = getStorage(getApp())

    for (const file of Array.from(selectedFiles)) {
      const fileRef = ref(storage, `${storagePath}/${file.name}`)
      await uploadBytes(fileRef, file)
      const url = await getDownloadURL(fileRef)
      setFiles(prev => [...prev, { name: file.name, url, type: file.type, path: fileRef.fullPath }])
    }

    setUploading(false)
    e.target.value = '' // Reset input
  }, [storagePath])

  const handleDelete = useCallback(async (file: UploadedFile) => {
    const storage = getStorage(getApp())
    const fileRef = ref(storage, file.path)
    await deleteObject(fileRef)
    setFiles(prev => prev.filter(f => f.path !== file.path))
  }, [])

  const images = files.filter(f => isImage(f.name))
  const docs = files.filter(f => !isImage(f.name))

  return (
    <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_4px_20px_rgba(40,20,10,.07)]">
      <div className="flex items-center justify-between mb-4">
        <p className="eyebrow">Uploads</p>
        <label className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-[600] cursor-pointer transition-colors',
          'bg-[#6B4C4C] text-[#F9F5F1] hover:bg-[#8A6060]',
          uploading && 'opacity-50 pointer-events-none'
        )}>
          <Upload className="h-3.5 w-3.5" />
          {uploading ? 'Uploading…' : 'Upload Files'}
          <input
            type="file"
            multiple
            accept={ACCEPTED}
            onChange={handleUpload}
            className="hidden"
            disabled={uploading}
          />
        </label>
      </div>

      <p className="text-[11px] text-[#7A6A60] mb-4">
        Supports: Images (PNG, JPG, GIF, WebP, SVG), Documents (PDF, DOCX, PPTX, XLSX)
      </p>

      {loading ? (
        <p className="text-[13px] text-[#7A6A60]">Loading…</p>
      ) : files.length === 0 ? (
        <div className="rounded-[12px] border-2 border-dashed border-[#D4CBC0] bg-[#F9F5F1] p-8 text-center">
          <Upload className="h-8 w-8 text-[#D4CBC0] mx-auto mb-2" />
          <p className="text-[13px] text-[#7A6A60]">No files uploaded yet for this week</p>
          <p className="text-[11px] text-[#D4CBC0] mt-1">Drag & drop or click "Upload Files" above</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Image grid — shown inline */}
          {images.length > 0 && (
            <div>
              <p className="text-[11px] font-[600] text-[#7A6A60] mb-2 uppercase tracking-wider">Images</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {images.map(file => (
                  <div key={file.path} className="group relative rounded-[12px] border border-[#D4CBC0] overflow-hidden bg-[#F9F5F1] aspect-square">
                    <img
                      src={file.url}
                      alt={file.name}
                      className="w-full h-full object-contain bg-white"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <a href={file.url} target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-white/90 text-[#2A1F1A] hover:bg-white mr-2">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                      <button onClick={() => handleDelete(file)} className="p-2 rounded-full bg-white/90 text-[#DC2626] hover:bg-white">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="px-2 py-1.5 text-[10px] text-[#7A6A60] truncate">{file.name}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Documents list — clickable links */}
          {docs.length > 0 && (
            <div>
              <p className="text-[11px] font-[600] text-[#7A6A60] mb-2 uppercase tracking-wider">Documents</p>
              <div className="space-y-2">
                {docs.map(file => (
                  <div key={file.path} className="flex items-center gap-3 rounded-[12px] border border-[#D4CBC0] bg-[#F9F5F1] px-4 py-3 hover:border-[#6B4C4C] hover:bg-white transition-colors group">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(107,76,76,.08)] text-[#6B4C4C]">
                      {getFileIcon(file.name)}
                    </div>
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 min-w-0 text-[13px] font-[500] text-[#2A1F1A] hover:text-[#6B4C4C] truncate"
                    >
                      {file.name}
                    </a>
                    <span className="text-[10px] text-[#7A6A60] uppercase shrink-0">
                      {file.name.split('.').pop()}
                    </span>
                    <button
                      onClick={(e) => { e.preventDefault(); handleDelete(file) }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded text-[#DC2626] hover:bg-[rgba(220,38,38,.08)] transition-opacity"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
