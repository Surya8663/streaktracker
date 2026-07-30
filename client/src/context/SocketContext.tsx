import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';
import { SOCKET_EVENTS } from '@streaktrack/shared';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  LogUpdatedPayload,
  PresenceUpdatePayload,
  MilestoneWonPayload,
} from '@streaktrack/shared';
import { useAuth } from './AuthContext';

interface SocketContextType {
  socket: Socket<ServerToClientEvents, ClientToServerEvents> | null;
  onlineUserIds: number[];
  isOnline: (userId: number) => boolean;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const [onlineUserIds, setOnlineUserIds] = useState<number[]>([]);

  useEffect(() => {
    const socketUrl = import.meta.env.VITE_WS_URL || import.meta.env.VITE_API_URL || 'https://streaktracker-back.onrender.com';
    const newSocket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
      socketUrl,
      {
        withCredentials: true,
        transports: ['websocket', 'polling'],
      },
    );

    setSocket(newSocket);

    newSocket.on(SOCKET_EVENTS.PRESENCE_UPDATE, (payload: PresenceUpdatePayload) => {
      setOnlineUserIds(payload.onlineUserIds || []);
    });

    newSocket.on(SOCKET_EVENTS.LOG_UPDATED, (payload: LogUpdatedPayload) => {
      // If the log was created/edited by another user, show toast!
      if (user && payload.userId !== user.id) {
        const actionText = payload.isEdit ? 'updated' : 'logged';
        toast.success(`🔥 ${payload.userName} just ${actionText} today's topics!`, {
          duration: 5000,
          position: 'top-right',
          style: {
            borderRadius: '16px',
            background: '#0f172a',
            color: '#fff',
            fontSize: '13px',
            fontWeight: '600',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.2)',
          },
        });
      }
    });

    newSocket.on(SOCKET_EVENTS.MILESTONE_COMPLETED, (payload: MilestoneWonPayload) => {
      const { milestone } = payload;
      if (user && milestone.winnerId === user.id) {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
        });
        toast.success(`🎉 You won 5-Day Block #${milestone.blockNumber}! ${milestone.loserName} owes you a treat! 🍫`, {
          duration: 7000,
          position: 'top-right',
          style: {
            borderRadius: '16px',
            background: '#047857',
            color: '#fff',
            fontSize: '13px',
            fontWeight: '600',
          },
        });
      } else if (user && milestone.loserId === user.id) {
        toast(`🍫 5-Day Block #${milestone.blockNumber} completed! You owe ${milestone.winnerName} a treat!`, {
          duration: 7000,
          position: 'top-right',
          icon: '🍫',
          style: {
            borderRadius: '16px',
            background: '#92400e',
            color: '#fff',
            fontSize: '13px',
            fontWeight: '600',
          },
        });
      }
    });

    return () => {
      newSocket.disconnect();
    };
  }, [user]);

  const isOnline = (targetUserId: number) => onlineUserIds.includes(targetUserId);

  return (
    <SocketContext.Provider value={{ socket, onlineUserIds, isOnline }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
