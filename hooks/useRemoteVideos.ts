import { useEffect, useState } from "react";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { VideoItem } from "@/constants/upiVideos";

/**
 * Custom hook to fetch UPI learning videos from Firestore
 * Falls back to local videos if fetch fails
 * 
 * Firestore structure:
 * Collection: upiVideos
 * Doc ID: <YouTube Video ID>
 * Fields:
 *   - title: string
 *   - lang: "hi" | "en" | "or" | "ta"
 *   - category: "basics" | "safety" | "fraud" | "upichallenge" | "govtschemes"
 *   - description: string
 *   - source: string
 */
export function useRemoteVideos() {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchVideos = async () => {
      try {
        setLoading(true);
        setError(null);

        const db = getFirestore();
        const videosCollection = collection(db, "upiVideos");
        const snapshot = await getDocs(videosCollection);

        if (!isMounted) return;

        const fetchedVideos = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<VideoItem, "id">),
        })) as VideoItem[];

        setVideos(fetchedVideos);
        console.log(`✅ Loaded ${fetchedVideos.length} videos from Firestore`);
      } catch (err) {
        if (!isMounted) return;

        console.warn("⚠️ Failed to load remote videos from Firestore:", err);
        setError(err as Error);
        
        // Videos will remain empty, allowing fallback to local data
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchVideos();

    return () => {
      isMounted = false;
    };
  }, []);

  return { videos, loading, error };
}
