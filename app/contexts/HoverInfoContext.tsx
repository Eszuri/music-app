import React, { createContext, useContext, useState } from 'react';

interface HoverInfoContextProps {
    hoverInfo: string | null;
    setHoverInfo: (info: string | null) => void;
}

const HoverInfoContext = createContext<HoverInfoContextProps | undefined>(undefined);

export function HoverInfoProvider({ children }: { children: React.ReactNode }) {
    const [hoverInfo, setHoverInfo] = useState<string | null>(null);

    return (
        <HoverInfoContext.Provider value={{ hoverInfo, setHoverInfo }}>
            {children}
        </HoverInfoContext.Provider>
    );
}

export function useHoverInfo() {
    const context = useContext(HoverInfoContext);
    if (!context) {
        throw new Error('useHoverInfo must be used within a HoverInfoProvider');
    }
    return context;
}
