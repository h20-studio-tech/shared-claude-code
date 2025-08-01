import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';

const ShareSessionModal = ({ isOpen, onClose, session, onSessionUpdated }) => {
  const [visibility, setVisibility] = useState('private');
  const [shareUrl, setShareUrl] = useState('');
  const [sharedUsers, setSharedUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && session) {
      loadSharingInfo();
    }
  }, [isOpen, session]);

  const loadSharingInfo = async () => {
    try {
      setIsLoading(true);
      const response = await api.fetch(`/api/sharing/sessions/${session.id}/sharing`);
      const data = await response.json();
      
      setVisibility(data.visibility);
      setShareUrl(data.shareUrl || '');
      setSharedUsers(data.sharedWith || []);
    } catch (error) {
      console.error('Error loading sharing info:', error);
      setError('Failed to load sharing information');
    } finally {
      setIsLoading(false);
    }
  };

  const updateVisibility = async (newVisibility) => {
    try {
      setIsLoading(true);
      const response = await api.fetch(`/api/sharing/sessions/${session.id}/visibility`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibility: newVisibility })
      });

      if (!response.ok) {
        throw new Error('Failed to update visibility');
      }

      const data = await response.json();
      setVisibility(newVisibility);
      setShareUrl(data.shareUrl || '');
      
      if (onSessionUpdated) {
        onSessionUpdated({ ...session, visibility: newVisibility });
      }
    } catch (error) {
      console.error('Error updating visibility:', error);
      setError('Failed to update session visibility');
    } finally {
      setIsLoading(false);
    }
  };

  const searchUsers = async (query) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      setIsSearching(true);
      const response = await api.fetch(`/api/sharing/users/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      setSearchResults(data.users || []);
    } catch (error) {
      console.error('Error searching users:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const shareWithUser = async (user, permission = 'view') => {
    try {
      const response = await api.fetch(`/api/sharing/sessions/${session.id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user.username, permission })
      });

      if (!response.ok) {
        throw new Error('Failed to share session');
      }

      const data = await response.json();
      setSharedUsers([...sharedUsers, {
        ...data.sharedWith,
        permission: data.permission
      }]);
      setSearchQuery('');
      setSearchResults([]);
    } catch (error) {
      console.error('Error sharing session:', error);
      setError('Failed to share session with user');
    }
  };

  const removeShare = async (userId) => {
    try {
      const response = await api.fetch(`/api/sharing/sessions/${session.id}/share/${userId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to remove share');
      }

      setSharedUsers(sharedUsers.filter(user => user.id !== userId));
    } catch (error) {
      console.error('Error removing share:', error);
      setError('Failed to remove user access');
    }
  };

  const copyShareUrl = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      // Could add a toast notification here
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-md mx-4 p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Share Session</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-md text-sm">
            {error}
          </div>
        )}

        {/* Visibility Settings */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Visibility
          </label>
          
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="radio"
                name="visibility"
                value="private"
                checked={visibility === 'private'}
                onChange={(e) => updateVisibility(e.target.value)}
                disabled={isLoading}
                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
              />
              <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                Private - Only you can access
              </span>
            </label>
            
            <label className="flex items-center">
              <input
                type="radio"
                name="visibility"
                value="shared"
                checked={visibility === 'shared'}
                onChange={(e) => updateVisibility(e.target.value)}
                disabled={isLoading}
                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
              />
              <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                Shared - Accessible via link
              </span>
            </label>
            
            <label className="flex items-center">
              <input
                type="radio"
                name="visibility"
                value="public"
                checked={visibility === 'public'}
                onChange={(e) => updateVisibility(e.target.value)}
                disabled={isLoading}
                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
              />
              <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                Public - Visible to everyone
              </span>
            </label>
          </div>
        </div>

        {/* Share URL */}
        {shareUrl && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Share Link
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={shareUrl}
                readOnly
                className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
              />
              <button
                onClick={copyShareUrl}
                className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Copy
              </button>
            </div>
          </div>
        )}

        {/* Share with specific users */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Share with Users
          </label>
          
          {/* Search users */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                searchUsers(e.target.value);
              }}
              placeholder="Search users..."
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
            />
            
            {/* Search results */}
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg z-10 max-h-40 overflow-y-auto">
                {searchResults.map(user => (
                  <button
                    key={user.id}
                    onClick={() => shareWithUser(user)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2"
                  >
                    {user.avatar_url && (
                      <img src={user.avatar_url} alt="" className="w-6 h-6 rounded-full" />
                    )}
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {user.display_name || user.username}
                      </div>
                      {user.display_name && (
                        <div className="text-gray-500 dark:text-gray-400">@{user.username}</div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Currently shared users */}
          {sharedUsers.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm text-gray-600 dark:text-gray-400">Shared with:</div>
              {sharedUsers.map(user => (
                <div key={user.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-md">
                  <div className="flex items-center gap-2">
                    {user.avatar_url && (
                      <img src={user.avatar_url} alt="" className="w-5 h-5 rounded-full" />
                    )}
                    <span className="text-sm text-gray-900 dark:text-white">
                      {user.display_name || user.username}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 px-2 py-1 bg-gray-200 dark:bg-gray-600 rounded">
                      {user.permission}
                    </span>
                  </div>
                  <button
                    onClick={() => removeShare(user.id)}
                    className="text-red-600 hover:text-red-700 text-sm"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareSessionModal;