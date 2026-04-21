'use client';

import { useState } from 'react';
import { LessonStart } from '@/components/lesson/lesson-start';
import { LessonBoard } from '@/components/lesson/lesson-board';

interface DemoMilestone {
  id: string;
  title: string;
  description: string;
  status: 'completed' | 'in_progress' | 'not_started';
}

interface DemoMediaAsset {
  id: string;
  url: string;
  type: string;
  caption: string;
}

interface DemoSessionData {
  sessionId: string;
  topic: string;
  milestones: DemoMilestone[];
  currentMilestoneId: string;
  mediaAssets: DemoMediaAsset[];
}

export default function DemoPage() {
  const [view, setView] = useState<'start' | 'board'>('start');
  const [sessionData, setSessionData] = useState<DemoSessionData | null>(null);

  const handleStartLesson = async (topic: string) => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Mock session data
    setSessionData({
      sessionId: 'demo-session-1',
      topic,
        milestones: [
          {
            id: '1',
          title: 'Introduction',
          description: 'Learn the basics',
          status: 'completed',
        },
        {
          id: '2',
          title: 'Core Concepts',
          description: 'Understand key ideas',
          status: 'in_progress',
        },
          {
            id: '3',
            title: 'Advanced Topics',
            description: 'Deep dive into details',
            status: 'not_started',
        },
      ],
      currentMilestoneId: '2',
      mediaAssets: [
        {
          id: 'asset1',
          url: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=800',
          type: 'image',
          caption: 'Example diagram for the lesson',
        },
      ],
    });
    
    setView('board');
  };

  const handleEndLesson = async () => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    alert('Lesson ended! Summary would be displayed here.');
    setView('start');
    setSessionData(null);
  };

  if (view === 'board' && sessionData) {

    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200 py-4">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-gray-900">Component Demo</h1>
              <button
                onClick={() => {
                  setView('start');
                  setSessionData(null);
                }}
                className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Reset Demo
              </button>
            </div>
          </div>
        </div>

        <LessonBoard
          sessionId={sessionData.sessionId}
          topic={sessionData.topic}
          milestones={sessionData.milestones}
          currentMilestoneId={sessionData.currentMilestoneId}
          mediaAssets={sessionData.mediaAssets}
          onEndLesson={handleEndLesson}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">Component Demo</h1>
            <button
              onClick={() => {
                setView('start');
                setSessionData(null);
              }}
              className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Reset Demo
            </button>
          </div>
        </div>
      </div>

      <LessonStart onStartLesson={handleStartLesson} />
    </div>
  );
}
