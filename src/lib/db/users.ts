import { updateDoc } from "firebase/firestore";

import { userRef } from "@/lib/db/refs";
import type { CityPick } from "@/lib/types";

export function setNickname(uid: string, nickname: string): Promise<void> {
  return updateDoc(userRef(uid), { nickname: nickname.trim() });
}

export function setCity(uid: string, place: CityPick): Promise<void> {
  return updateDoc(userRef(uid), {
    city: place.city,
    lat: place.lat,
    lng: place.lng,
    tz: place.tz,
  });
}
