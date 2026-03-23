"use client";

import { MediaMetadata } from "@/lib/storage";
import { MediaCard } from "./MediaCard";
import { UploadModal } from "./UploadModal";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

export function MasonryGallery({ items }: { items: MediaMetadata[] }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <motion.div 
          initial={{ scale: 0.95, opacity: 0, y: 20 }} 
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-md w-full glass-card p-12 flex flex-col items-center space-y-6"
        >
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-3xl font-semibold tracking-tight text-foreground">Nothing here yet</h2>
          <p className="text-muted-foreground text-center">
            Upload some photos or videos to start building your chronological visual story.
          </p>
          <div className="pt-4">
            <UploadModal />
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-8 mt-12 pb-24">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-end mb-6"
      >
        <UploadModal />
      </motion.div>
      
      {/* CSS Columns based Masonry */}
      <div className="columns-1 sm:columns-2 md:columns-3 xl:columns-4 gap-4 space-y-4">
        {items.map((item, idx) => (
          <MediaCard key={item.id} media={item} index={idx} />
        ))}
      </div>
    </div>
  );
}
