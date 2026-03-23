import { getMedia } from "@/app/actions";
import { MasonryGallery } from "@/components/MasonryGallery";

export const dynamic = "force-dynamic"; // Ensures fresh data load

export default async function Home() {
  const mediaItems = await getMedia();
  
  return (
    <main className="min-h-screen bg-background text-foreground relative selection:bg-primary/30">
      {/* Background ambient light effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] rounded-full bg-primary/10 blur-[100px]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
        <header className="mb-16 flex flex-col items-center justify-center text-center space-y-4">
          <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-medium text-primary mb-2">
            ✨ Memories captured in time
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter">
            Visual <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/50">Journal</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto font-light">
            An aesthetic, chronological archive of moments. Upload your visual stories and let them organize themselves beautifully.
          </p>
        </header>

        <MasonryGallery items={mediaItems} />
      </div>
    </main>
  );
}
