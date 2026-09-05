import React, { useRef } from 'react';
import { Upload, Link as LinkIcon, Image as ImageIcon, X } from 'lucide-react';

interface ImageInputProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
  placeholder?: string;
  required?: boolean;
  helpText?: string;
}

// Utility to convert Google Drive share links to raw image URLs
export const processImageUrl = (url: string): string => {
  if (!url) return '';
  const trimmed = url.trim();

  // Handle Google Drive file link formats:
  // e.g. https://drive.google.com/file/d/1ABC123xyz/view?usp=sharing
  // e.g. https://drive.google.com/open?id=1ABC123xyz
  const driveFileMatch = trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  const driveIdMatch = trimmed.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
  const driveUcMatch = trimmed.match(/drive\.google\.com\/uc\?.*id=([a-zA-Z0-9_-]+)/);

  const fileId = driveFileMatch?.[1] || driveIdMatch?.[1] || driveUcMatch?.[1];

  if (fileId) {
    // High-reliability Google Drive direct image thumbnail view
    return `https://lh3.googleusercontent.com/d/${fileId}`;
  }

  return trimmed;
};

export const ImageInput: React.FC<ImageInputProps> = ({
  label,
  value,
  onChange,
  placeholder = 'Paste Image URL or Google Drive link...',
  required = false,
  helpText
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const processed = processImageUrl(rawVal);
    onChange(processed);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit (max 5MB for base64 local storage)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size exceeds 5MB. Please choose a smaller image.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onChange(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="image-input-container">
      <label className="image-input-label">
        <ImageIcon size={14} className="label-icon text-primary" /> {label} {required && <span className="text-danger">*</span>}
      </label>

      <div className="image-input-controls">
        <div className="text-input-wrapper">
          <LinkIcon size={14} className="input-icon" />
          <input
            type="text"
            value={value}
            onChange={handleTextChange}
            placeholder={placeholder}
            className="form-control text-input-field"
            required={required && !value}
          />
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="btn-secondary upload-file-btn"
          title="Upload image from saved local files or device"
        >
          <Upload size={14} /> Browse File
        </button>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*"
          style={{ display: 'none' }}
        />
      </div>

      {helpText && <small className="image-input-help-text">{helpText}</small>}

      {/* Image Preview Box */}
      {value && (
        <div className="image-preview-wrapper glass-card">
          <img
            src={value}
            alt="Preview"
            className="image-preview-thumb"
            onError={(e) => {
              // Hide broken preview fallback
              (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=200';
            }}
          />
          <div className="preview-meta">
            <span className="preview-status text-primary">✓ Image Source Loaded</span>
            <span className="preview-type">
              {value.startsWith('data:image')
                ? 'Uploaded Local Saved File (Base64)'
                : value.includes('googleusercontent')
                ? 'Google Drive Image Link'
                : 'Direct Web Image URL'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onChange('')}
            className="remove-preview-btn"
            title="Clear Image"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <style>{`
        .image-input-container {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .image-input-label {
          font-weight: 600;
          font-size: 0.85rem;
          display: flex;
          align-items: center;
          gap: 0.4rem;
          color: var(--text-primary);
        }

        .text-danger {
          color: #ef4444;
        }

        .image-input-controls {
          display: flex;
          gap: 0.5rem;
          align-items: center;
        }

        .text-input-wrapper {
          position: relative;
          flex: 1;
        }

        .text-input-wrapper .input-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-secondary);
        }

        .text-input-field {
          padding-left: 2.2rem !important;
          font-size: 0.85rem;
          width: 100%;
        }

        .upload-file-btn {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.6rem 0.9rem;
          font-size: 0.8rem;
          white-space: nowrap;
          cursor: pointer;
          border-radius: var(--border-radius-sm);
        }

        .image-input-help-text {
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        .image-preview-wrapper {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.5rem 0.75rem;
          border-radius: var(--border-radius-sm);
          margin-top: 0.25rem;
          background: rgba(0, 255, 204, 0.04);
          border: 1px dashed rgba(0, 255, 204, 0.2);
        }

        .image-preview-thumb {
          width: 42px;
          height: 42px;
          object-fit: cover;
          border-radius: 4px;
          border: 1px solid var(--border-color);
        }

        .preview-meta {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.1rem;
        }

        .preview-status {
          font-weight: 700;
          font-size: 0.75rem;
        }

        .preview-type {
          font-size: 0.7rem;
          color: var(--text-secondary);
        }

        .remove-preview-btn {
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 0.2rem;
          border-radius: 4px;
        }

        .remove-preview-btn:hover {
          color: #ef4444;
          background: rgba(239, 68, 68, 0.1);
        }
      `}</style>
    </div>
  );
};
