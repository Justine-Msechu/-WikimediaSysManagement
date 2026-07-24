import React, { createContext, useContext, useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase/config";
import { getDocument, setDocument } from "../firebase/firestore";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [profile, setProfile]         = useState(null); // Firestore user doc
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const prof = await getDocument("users", firebaseUser.uid);
        setCurrentUser(firebaseUser);
        setProfile(prof);
      } else {
        setCurrentUser(null);
        setProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  // Refresh profile from Firestore (call after role/name changes)
  const refreshProfile = async () => {
    if (!currentUser) return;
    const prof = await getDocument("users", currentUser.uid);
    setProfile(prof);
  };

  const value = { currentUser, profile, loading, refreshProfile };
  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
