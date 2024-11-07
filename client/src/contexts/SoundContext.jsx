import { createContext, useContext } from 'react';
import clickSound from '../assets/sounds/click-sound.mp3';

const SoundContext = createContext();

export function SoundProvider({ children }) {
    const clickAudio = new Audio(clickSound);

    const playClick = async () => {
        try {
            await clickAudio.play();
        } catch (error) {
            console.error('Error playing sound:', error);
        }
    };

    return (
        <SoundContext.Provider value={{ playClick }}>
            {children}
        </SoundContext.Provider>
    );
}

export function useSound() {
    const context = useContext(SoundContext);
    if (!context) {
        throw new Error('useSound must be used within a SoundProvider');
    }
    return context;
}