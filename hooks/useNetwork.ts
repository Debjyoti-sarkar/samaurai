import NetInfo from "@react-native-community/netinfo";
import { useEffect, useState } from "react";

export function useNetwork() {
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [isWeak, setIsWeak] = useState<boolean>(false);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      const connected = !!state.isConnected;
      setIsConnected(connected);

      // Detect weak network heuristics:
      let weak = false;
      if (!connected) weak = true;
      else if (state.type === "cellular") {
        const gen = (state.details as any)?.cellularGeneration;
        if (gen === "2g" || gen === "3g") weak = true;
      } else if (state.type === "wifi") {
        const strength = (state.details as any)?.strength ?? 100;
        if (strength < 30) weak = true;
      }
      setIsWeak(weak);
    });

    return () => unsub();
  }, []);

  return { isConnected, isWeak };
}
