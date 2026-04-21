'use client';

import { useState } from 'react';
import { CheckCircle2, Circle } from 'lucide-react';

interface Milestone {
  id: string;
  title: string;
  description: string;
  status: 'not_started' | 'in_progress' | 'completed';
}

interface MediaAsset {
  id: string;
  url: string;
  type: string;
  caption?: string;
}

interface LessonBoardProps {
  sessionId: string;
  topic: string;
  milestones: Milestone[];
  currentMilestoneId: string | null;
  mediaAssets: MediaAsset[];
  onEndLesson: () => Promise<void>;
}

export function LessonBoard({
  sessionId,
  topic,
  milestones,
  currentMilestoneId,
  mediaAssets,
  onEndLesson,
}: LessonBoardProps) {
  const [isEnding, setIsEnding] = useState(false);

  const handleEndLesson = async () => {
    setIsEnding(true);
    try {
      await onEndLesson();
    } catch (error) {
      console.error('Failed to end lesson:', error);
      setIsEnding(false);
    }
  };

  const currentMilestone = milestones.find(m => m.id === currentMilestoneId);

  return (
    <div className="min-h-screen bg-gray-50" data-session-id={sessionId}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{topic}</h1>
              {currentMilestone && (
                <p className="text-gray-600">
                  Current: <span className="font-medium">{currentMilestone.title}</span>
                </p>
              )}
            </div>
            <button
              onClick={handleEndLesson}
              disabled={isEnding}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {isEnding ? 'Ending...' : 'End Lesson'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content Area */}
          <div className="lg:col-span-2 space-y-6">
            {/* Teaching Content */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Lesson Content</h2>
              
              {/* Media Assets Display */}
              {mediaAssets.length > 0 && (
                <div className="mb-6 space-y-4">
                  {mediaAssets.map((asset) => (
                    <div key={asset.id} className="border border-gray-200 rounded-lg overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={asset.url}
                        alt={asset.caption || 'Lesson visual'}
                        className="w-full h-auto"
                      />
                      {asset.caption && (
                        <p className="p-3 text-sm text-gray-600 bg-gray-50">{asset.caption}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Placeholder for teaching interactions */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <p className="text-gray-500">
                  Teaching interactions will appear here
                </p>
              </div>
            </div>

            {/* Input Area Placeholder */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Response</h3>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <p className="text-gray-500">
                  Voice, text, and canvas input will be available here
                </p>
              </div>
            </div>
          </div>

          {/* Sidebar - Progress Tracking */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm p-6 sticky top-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Progress</h3>
              
              <div className="space-y-3">
                {milestones.map((milestone) => {
                  const isCurrent = milestone.id === currentMilestoneId;
                  
                  return (
                    <div
                      key={milestone.id}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        isCurrent
                          ? 'border-indigo-500 bg-indigo-50'
                          : milestone.status === 'completed'
                          ? 'border-green-200 bg-green-50'
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 mt-0.5">
                          {milestone.status === 'completed' ? (
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                          ) : isCurrent ? (
                            <Circle className="w-5 h-5 text-indigo-600 fill-indigo-600" />
                          ) : (
                            <Circle className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${
                            isCurrent ? 'text-indigo-900' : 
                            milestone.status === 'completed' ? 'text-green-900' : 
                            'text-gray-700'
                          }`}>
                            {milestone.title}
                          </p>
                          <p className={`text-xs mt-1 ${
                            isCurrent ? 'text-indigo-700' : 
                            milestone.status === 'completed' ? 'text-green-700' : 
                            'text-gray-500'
                          }`}>
                            {milestone.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Progress Summary */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Completed</span>
                  <span className="font-semibold text-gray-900">
                    {milestones.filter(m => m.status === 'completed').length} / {milestones.length}
                  </span>
                </div>
                <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
                    style={{
                      width: `${(milestones.filter(m => m.status === 'completed').length / milestones.length) * 100}%`
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
