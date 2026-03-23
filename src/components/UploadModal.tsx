"use client";

import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useDropzone } from "react-dropzone";
import { UploadCloud, CheckCircle2, Loader2, ImagePlus } from "lucide-react";
import { uploadMedia } from "@/app/actions";
import { useRouter } from "next/navigation";

export function UploadModal() {
  const [open, setOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{current: number, total: number} | null>(null);
  const router = useRouter();

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    setIsUploading(true);
    setUploadProgress({ current: 0, total: acceptedFiles.length });

    for (let i = 0; i < acceptedFiles.length; i++) {
        const file = acceptedFiles[i];
        const formData = new FormData();
        formData.append("file", file);
        
        try {
            const result = await uploadMedia(formData);
            if (!result.success) {
                console.error("Upload failed for file:", file.name, result.error);
                alert("Upload failed for " + file.name + ": " + result.error);
            }
        } catch(e: any) {
            console.error("Exception during upload:", e);
            alert("Exception during upload: " + e.message);
        }
        setUploadProgress({ current: i + 1, total: acceptedFiles.length });
    }

    setIsUploading(false);
    setOpen(false);
    router.refresh();
  }, [router]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': [],
      'video/*': []
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="lg" className="rounded-full shadow-lg bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2" />}>
        <ImagePlus className="w-5 h-5"/> Upload Memories
      </DialogTrigger>
      <DialogContent className="sm:max-w-md glass-card border-white/10 dark:border-white/10">
        <DialogHeader>
          <DialogTitle>Upload Photos & Videos</DialogTitle>
          <DialogDescription>
            Drag & drop your files here. We'll automatically arrange them by their metadata.
          </DialogDescription>
        </DialogHeader>

        <div
          {...getRootProps()}
          className={`mt-4 p-12 border-2 border-dashed rounded-xl flex flex-col items-center justify-center transition-colors cursor-pointer ${
            isDragActive ? "border-primary bg-primary/10" : "border-muted-foreground/30 hover:bg-white/5"
          }`}
        >
          <input {...getInputProps()} />
          
          {isUploading ? (
            <div className="flex flex-col items-center text-primary gap-4">
              <Loader2 className="w-10 h-10 animate-spin" />
              <p className="text-sm font-medium">Uploading {uploadProgress?.current} of {uploadProgress?.total}...</p>
            </div>
          ) : isDragActive ? (
            <div className="flex flex-col items-center text-primary gap-4">
              <UploadCloud className="w-10 h-10 animate-bounce" />
              <p className="font-medium">Drop the files here...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center text-muted-foreground gap-4">
              <UploadCloud className="w-10 h-10" />
              <p className="text-center">Drag 'n' drop files here, or click to select files</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
