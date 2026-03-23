"use client";

import { MediaMetadata } from "@/lib/storage";
import { motion } from "framer-motion";
import { format } from "date-fns";

export function MediaCard({ media, index }: { media: MediaMetadata, index: number }) {
  const isVideo = media.type === "video";
  
  // Format the date if we have one, otherwise fallback to "Unknown Date"
  const dateStr = media.dateTaken 
    ? format(new Date(media.dateTaken), "MMMM d, yyyy") 
    : format(new Date(media.uploadedAt), "MMMM d, yyyy '(Uploaded)'");
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: Math.min(index * 0.05, 0.5) }}
      whileHover={{ scale: 1.02 }}
      className="relative group rounded-xl overflow-hidden glass-card break-inside-avoid mb-4 border border-white/5 shadow-sm"
    >
      {isVideo ? (
        <video 
          src={media.url} 
          className="w-full h-auto object-cover"
          muted
          loop
          playsInline
          autoPlay
        />
      ) : (
        <img 
          src={media.url} 
          alt={`Memory from ${dateStr}`}
          loading="lazy"
          className="w-full h-auto object-cover"
        />
      )}
      
      {/* Premium Hover Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-end p-5">
        <motion.p 
          initial={{ y: 10, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          className="text-white font-medium drop-shadow-md text-lg tracking-tight"
        >
          {dateStr}
        </motion.p>
        {isVideo && (
          <span className="text-xs text-white/70 uppercase tracking-wider mt-1 font-semibold">Video</span>
        )}
      </div>
    </motion.div>
  );
}
