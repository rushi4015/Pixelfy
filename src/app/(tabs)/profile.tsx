import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  Image, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert, 
  ScrollView,
  useWindowDimensions,
  RefreshControl,
  Share
} from 'react-native';
import FontAwesome from "@expo/vector-icons/FontAwesome";
import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import ViewImage from '~/Components/viewImage';
import StoryViewer from '~/app/story/StoryViewer';
import { useAuth } from '~/providers/AuthProvider';
import { supabase } from '~/lib/supabase';

// Define the Post type
type Post = {
  id: string;
  media_url: string;
  caption: string;
  created_at: string;
  user: {
    username: string;
    avatar_url: string;
  };
  likes_count: number;
};

const ProfileScreen = () => {
  const { user } = useAuth();
  const { refresh } = useLocalSearchParams();
  const [profile, setProfile] = useState<any>(null);
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsCount, setPostsCount] = useState(0);
  const [activeTab, setActiveTab] = useState('posts'); // 'posts' or 'saved'
  const { width } = useWindowDimensions();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<{
    id: string;
    mediaUrl: string;
    username: string;
    avatarUrl: string;
    timestamp: string;
    caption: string;
    likesCount: number;
    comments: any[];
  } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [stories, setStories] = useState<Story[]>([]);
  const [showStoryViewer, setShowStoryViewer] = useState(false);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  useEffect(() => {
    const fetchStories = async () => {
      try {
        const { data, error } = await supabase
          .from('stories')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true });

        if (error) throw error;
        setStories(data || []);
      } catch (error) {
        console.error('Error fetching stories:', error);
      }
    };

    if (user) {
      fetchStories();
    }
  }, [user]);

  useEffect(() => {
    if (refresh === 'true') {
      fetchProfile();
    }
  }, [refresh]);

  const fetchProfile = async () => {
    setIsLoading(true);
    try {
      const [profileResponse, postsResponse, followersResponse, followingResponse] = await Promise.all([
        supabase
          .from('users')
          .select('id, username, full_name, email, avatar_url, bio, website, is_private, verified')
          .eq('id', user.id)
          .single(),
        supabase
          .from('posts')
          .select(`
            id, 
            media_url, 
            caption, 
            created_at, 
            user:users(username, avatar_url),
            likes:likes(count)
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .range(0, 9), // Only fetch first 10 posts initially
        supabase
          .from('friends')
          .select('friend_id', { count: 'exact' })
          .eq('friend_id', user.id), // Count followers
        supabase
          .from('friends')
          .select('user_id', { count: 'exact' })
          .eq('user_id', user.id) // Count following
      ]);

      if (profileResponse.error) throw profileResponse.error;
      if (postsResponse.error) throw postsResponse.error;
      if (followersResponse.error) throw followersResponse.error;
      if (followingResponse.error) throw followingResponse.error;

      setProfile(profileResponse.data);
      setUsername(profileResponse.data.username || '');
      setBio(profileResponse.data.bio || '');

      const processedPosts = postsResponse.data.map(post => ({
        ...post,
        likes_count: post.likes[0]?.count || 0
      }));

      setPosts(processedPosts || []);
      setPostsCount(processedPosts.length || 0);
      setHasMorePosts(processedPosts.length >= 10);

      // Update follower and following counts
      const followersCount = followersResponse.count || 0;
      const followingCount = followingResponse.count || 0;

      // Set the counts in state (you'll need to create these states)
      setFollowersCount(followersCount);
      setFollowingCount(followingCount);

    } catch (error) {
      console.error('Error fetching profile data:', error.message);
      Alert.alert('Error', 'Failed to load profile data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ username, bio })
        .eq('id', user.id);

      if (error) throw error;

      Alert.alert('Success', 'Profile updated successfully');
      await fetchProfile();
    } catch (error) {
      console.error('Error updating profile:', error.message);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleShareProfile = async () => {
    try {
      // Debugging: Log the username and share message
      console.log('Username:', username);
      const shareMessage = `Check out my profile on Pixelfy: https://pixelfy.com/profile/${username}`;
      console.log('Share Message:', shareMessage); // Log the share message
      await Share.share({
        message: shareMessage,
      });
    } catch (error) {
      console.error('Error sharing profile:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProfile();
    setRefreshing(false);
  };

  const loadMorePosts = async () => {
    if (!hasMorePosts) return;
    
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          id, 
          media_url, 
          caption, 
          created_at, 
          user:users(username, avatar_url),
          likes:likes(count)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(page * 10, (page + 1) * 10 - 1);

      if (error) throw error;

      if (data.length > 0) {
        const processedPosts = data.map(post => ({
          ...post,
          likes_count: post.likes[0]?.count || 0
        }));

        setPosts(prev => [...prev, ...processedPosts]);
        setPage(prev => prev + 1);
        setHasMorePosts(data.length >= 10);
      } else {
        setHasMorePosts(false);
      }
    } catch (error) {
      console.error('Error loading more posts:', error);
    }
  };

  const handlePostPress = (post: Post) => {
    // Create a new object with all required data
    const postData = {
      id: post.id,
      mediaUrl: post.media_url,
      username: post.user.username,
      avatarUrl: post.user.avatar_url,
      timestamp: post.created_at,
      caption: post.caption,
      likesCount: post.likes_count,
      comments: []
    };
    
    // Set the selected post data
    setSelectedPost(postData);
  };

  const handleAvatarPress = () => {
    if (stories.length > 0) {
      // Create grouped stories object with proper structure
      const groupedStories = {
        [user.id]: stories.map(story => ({
          id: story.id,
          media_url: story.media_url,
          type: story.media_type,
          caption: story.caption,
          created_at: story.created_at,
          user: {
            id: user.id,
            username: profile.username,
            avatar_url: profile.avatar_url
          }
        }))
      };

      router.push({
        pathname: "/story/StoryViewer",
        params: { 
          storyData: JSON.stringify(groupedStories),
          initialUserId: user.id
        }
      });
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#0ea5e9" />
      </View>
    );
  }

  return (
    <>
      <View className="flex-row items-center justify-between px-4 py-2 border-b border-gray-200 bg-white">
        <Text className="text-xl font-bold">{username || 'Username'}</Text>
        <View className="flex-row items-center space-x-4">
          <TouchableOpacity 
            onPress={() => router.push('/(tabs)/new')}
            className="active:opacity-50"
          >
            <Feather name="plus-square" size={25} color="black" />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => {/* Add menu handler */}}
            className="active:opacity-50"
          >
            <Ionicons name="menu" size={28} color="black" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        className="flex-1 bg-gray-50" 
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View className="px-4 py-6 bg-white rounded-lg shadow-md mb-4">
          <View className="flex-row mb-4">
            <TouchableOpacity 
              onPress={handleAvatarPress}
              disabled={stories.length === 0}
              className="mr-4"
            >
              {profile.avatar_url ? (
                <Image
                  source={{ uri: profile.avatar_url }}
                  className={`w-24 h-24 rounded-full border-2 ${
                    stories.length > 0 ? 'border-blue-500' : 'border-gray-200'
                  }`}
                />
              ) : (
                <View className="w-24 h-24 rounded-full bg-gray-100 items-center justify-center border-2 border-gray-200">
                  <FontAwesome name="user" size={40} color="#9ca3af" />
                </View>
              )}
            </TouchableOpacity>

            <View className="flex-1 justify-center">
              <Text className="text-lg font-bold">{username}</Text>
              {profile.full_name && (
                <Text className="text-sm font-semibold">{profile.full_name}</Text>
              )}
              {bio && (
                <Text className="text-sm mt-1">{bio}</Text>
              )}
            </View>
          </View>

          <View className="flex-row justify-around mb-4">
            <View className="items-center">
              <Text className="text-lg font-bold">{postsCount}</Text>
              <Text className="text-sm text-gray-500">Posts</Text>
            </View>
            <View className="items-center">
              <Text className="text-lg font-bold">{followersCount}</Text>
              <Text className="text-sm text-gray-500">Followers</Text>
            </View>
            <View className="items-center">
              <Text className="text-lg font-bold">{followingCount}</Text>
              <Text className="text-sm text-gray-500">Following</Text>
            </View>
          </View>

          <View className="flex-row gap-2 mb-6">
            <TouchableOpacity 
              onPress={() => router.push('/(screens)/edit-profile')}
              className="flex-1 py-2 rounded-lg bg-blue-500"
            >
              <Text className="text-center text-white font-semibold">Edit Profile</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={handleShareProfile}
              className="flex-1 py-2 rounded-lg bg-green-500"
            >
              <Text className="text-center text-white font-semibold">Share Profile</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Grid Toggle */}
        <View className="flex-row border-t border-gray-200">
          <TouchableOpacity 
            onPress={() => setActiveTab('posts')}
            className={`flex-1 p-3 items-center ${
              activeTab === 'posts' ? 'border-b-2 border-black' : ''
            }`}
          >
            <FontAwesome 
              name="th" 
              size={24} 
              color={activeTab === 'posts' ? 'black' : 'gray'} 
            />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => setActiveTab('saved')}
            className={`flex-1 p-3 items-center ${
              activeTab === 'saved' ? 'border-b-2 border-black' : ''
            }`}
          >
            <FontAwesome 
              name="bookmark-o" 
              size={24} 
              color={activeTab === 'saved' ? 'black' : 'gray'} 
            />
          </TouchableOpacity>
        </View>

        {/* Posts Grid */}
        {activeTab === 'posts' && (
          <View className="flex-row flex-wrap mt-5" style={{ width: '100%' }}>
            {posts.map((post) => (
              <TouchableOpacity 
                key={post.id} 
                className="w-[48%] mb-2 mx-[1%]"
                onPress={() => handlePostPress(post)}
              >
                <View className="aspect-square rounded-lg shadow-sm bg-gray-100 overflow-hidden">
                  <Image
                    source={{ uri: post.media_url }}
                    className="w-full h-full"
                    style={{ resizeMode: 'cover' }}
                  />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Empty State */}
        {posts.length === 0 && activeTab === 'posts' && (
          <View className="items-center justify-center py-12">
            <FontAwesome name="camera" size={48} color="#9ca3af" />
            <Text className="text-gray-400 mt-4 text-center">
              No Posts Yet
            </Text>
            <TouchableOpacity 
              onPress={() => router.push('/(tabs)/new')}
              className="mt-4 bg-blue-500 px-6 py-3 rounded-full"
            >
              <Text className="text-white font-semibold">Share Your First Post</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Saved Posts Empty State */}
        {activeTab === 'saved' && (
          <View className="items-center justify-center py-12">
            <FontAwesome name="bookmark" size={48} color="#9ca3af" />
            <Text className="text-gray-400 mt-4 text-center">
              No Saved Posts
            </Text>
          </View>
        )}

        {/* Add loading indicator at the bottom */}
        {hasMorePosts && (
          <View className="py-4">
            <ActivityIndicator size="small" color="#0ea5e9" />
          </View>
        )}
      </ScrollView>
    </>
  );
};

// Helper function to check if user is close to bottom
const isCloseToBottom = ({ layoutMeasurement, contentOffset, contentSize }) => {
  const paddingToBottom = 20;
  return layoutMeasurement.height + contentOffset.y >=
    contentSize.height - paddingToBottom;
};

export default ProfileScreen;
