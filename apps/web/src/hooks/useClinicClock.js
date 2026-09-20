import { useEffect, useState } from 'react';
import { clinicClock } from '../utils/format.js';

export function useClinicClock(timeZone = 'Asia/Kolkata') {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return clinicClock(now, timeZone);
}
