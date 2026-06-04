import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileImage, FileText, X, AlertCircle } from 'lucide-react';

const FileItem = ({ file, onRemove }) => {
  const isImage = file.type.startsWith('image/');
  const sizeMB = (file.size / 1024 / 1024).toFixed(2);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10 group"
    >
      <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
        {isImage
          ? <FileImage size={18} className="text-blue-400" />
          : <FileText size={18} className="text-blue-400" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-medium truncate">{file.name}</p>
        <p className="text-xs text-gray-500">{sizeMB} MB • {file.type || 'unknown type'}</p>
      </div>
      <button
        onClick={() => onRemove(file)}
        className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center hover:bg-red-500/20 transition-colors opacity-0 group-hover:opacity-100"
        type="button"
        aria-label="Remove file"
      >
        <X size={14} className="text-red-400" />
      </button>
    </motion.div>
  );
};

export default function FileDropzone({ files, onChange }) {
  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'application/pdf': ['.pdf']
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    onDrop: (accepted) => onChange([...files, ...accepted]),
  });

  const removeFile = (file) => onChange(files.filter(f => f !== file));

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        id="file-dropzone"
        className={`relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-300 select-none
          ${isDragActive
            ? 'border-blue-500 bg-blue-500/10 scale-[1.02]'
            : 'border-white/10 hover:border-blue-500/50 hover:bg-white/5'
          }`}
      >
        <input {...getInputProps()} />
        <motion.div
          animate={isDragActive ? { scale: 1.1 } : { scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ${
            isDragActive ? 'bg-blue-500/30' : 'bg-white/5'
          }`}>
            <Upload size={28} className={isDragActive ? 'text-blue-400' : 'text-gray-400'} />
          </div>
          <div>
            <p className="text-white font-semibold text-lg">
              {isDragActive ? 'Drop files here' : 'Drag & drop documents'}
            </p>
            <p className="text-gray-500 text-sm mt-1">
              or <span className="text-blue-400 font-medium">browse files</span>
            </p>
            <p className="text-gray-600 text-xs mt-2">PDF, JPG, PNG • Max 10MB per file</p>
          </div>
        </motion.div>
      </div>

      {fileRejections.length > 0 && (
        <div className="flex items-start gap-2 p-3 bg-red-500/10 rounded-xl border border-red-500/20">
          <AlertCircle size={15} className="text-red-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-400">
            {fileRejections[0].errors[0].message}
          </p>
        </div>
      )}

      {files.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
            {files.length} file{files.length > 1 ? 's' : ''} selected
          </p>
          <AnimatePresence>
            {files.map((file, i) => (
              <FileItem key={`${file.name}-${i}`} file={file} onRemove={removeFile} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
