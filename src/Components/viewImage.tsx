import React, { useState, useEffect } from 'react';
import { Modal, Image, TouchableOpacity, View, Text, Pressable, LayoutChangeEvent, ScrollView, TextInput } from 'react-native';
import { GestureHandlerRootView, PinchGestureHandler, PinchGestureHandlerGestureEvent, State } from 'react-native-gesture-handler';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import Animated, { useAnimatedGestureHandler, useSharedValue, withSpring } from 'react-native-reanimated';
import { supabase } from '../lib/supabase';
import { useAuth } from '~/src/providers/AuthProvider';
import { Alert } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';

interface Comment {
  id: string;
  user: {
    username: string;
    avatar_url: string;
  };
  content: string;
  created_at: string;
}

interface ViewImageProps {
  visible: boolean;
  imageUrl: string;
  onClose: () => void;
  postId?: string;
}

const formatTimeAgo = (date: Date) => {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + 'y';
  
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + 'm';
  
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + 'd';
  
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + 'h';
  
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + 'm';
  
  return Math.floor(seconds) + 's';
};

const ViewImage: React.FC<ViewImageProps> = ({ 
  visible, 
  imageUrl, 
  onClose,
  postId
}) => {
  const [fullScreen, setFullScreen] = useState(false);
  const [originalWidth, setOriginalWidth] = useState(0);
  const [originalHeight, setOriginalHeight] = useState(0);
  const { user, username: currentUsername } = useAuth();
  const [postData, setPostData] = useState<{
    username: string;
    avatarUrl: string;
    timestamp: Date;
    likesCount: number;
    caption: string;
  } | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [showOptions, setShowOptions] = useState(false);

  // Shared values for animated zoom
  const scale = useSharedValue(1);

  // Handle pinch-to-zoom gestures
  const pinchHandler = useAnimatedGestureHandler<PinchGestureHandlerGestureEvent>({
    onStart: (_, ctx: { startScale: number }) => {
      ctx.startScale = scale.value;
    },
    onActive: (event, ctx) => {
      scale.value = Math.max(1, Math.min(ctx.startScale * event.scale, 3));
    },
    onEnd: () => {
      scale.value = withSpring(1); // Reset zoom when user lifts fingers
    },
  });

  // Fetch original image dimensions
  useEffect(() => {
    if (imageUrl) {
      Image.getSize(imageUrl, (width, height) => {
        setOriginalWidth(width);
        setOriginalHeight(height);
      });
    }
  }, [imageUrl]);

  // Fetch post data when postId changes
  useEffect(() => {
    const fetchPostData = async () => {
      if (!postId) return;
      
      try {
        // First, fetch post details and user info
        const { data: postData, error: postError } = await supabase
          .from('posts')
          .select(`
            id,
            caption,
            created_at,
            users (
              username,
              avatar_url
            )
          `)
          .eq('id', postId)
          .single();

        if (postError) throw postError;

        // Then, count likes for this post
        const { count: likesCount, error: likesError } = await supabase
          .from('likes')
          .select('id', { count: 'exact' })
          .eq('post_id', postId);

        if (likesError) throw likesError;

        setPostData({
          username: postData.users.username,
          avatarUrl: postData.users.avatar_url,
          timestamp: new Date(postData.created_at),
          likesCount: likesCount || 0,
          caption: postData.caption || '',
        });
      } catch (error) {
        console.error('Error fetching post data:', error);
      }
    };

    fetchPostData();
  }, [postId]);

  // Add comments fetch
  useEffect(() => {
    const fetchComments = async () => {
      if (!postId) return;
      
      try {
        const { data, error } = await supabase
          .from('comments')
          .select(`
            id,
            content,
            created_at,
            users (
              username,
              avatar_url
            )
          `)
          .eq('post_id', postId)
          .order('created_at', { ascending: true });

        if (error) throw error;

        setComments(data.map(comment => ({
          id: comment.id,
          user: {
            username: comment.users.username,
            avatar_url: comment.users.avatar_url
          },
          content: comment.content,
          created_at: comment.created_at
        })));
      } catch (error) {
        console.error('Error fetching comments:', error);
      }
    };

    fetchComments();
  }, [postId]);

  const handleAddComment = async () => {
    if (!newComment.trim() || !postId || !user || !currentUsername) return;

    try {
      const { data, error } = await supabase
        .from('comments')
        .insert({
          post_id: postId,
          user_id: user.id,
          content: newComment.trim()
        })
        .select(`
          id,
          content,
          created_at,
          users (
            username,
            avatar_url
          )
        `)
        .single();

      if (error) throw error;

      // Add new comment to state using current user's username
      setComments(prev => [...prev, {
        id: data.id,
        user: {
          username: currentUsername,
          avatar_url: data.users.avatar_url
        },
        content: data.content,
        created_at: data.created_at
      }]);

      setNewComment('');
    } catch (error) {
      console.error('Error adding comment:', error);
      Alert.alert('Error', 'Failed to add comment');
    }
  };

  const handleDownload = async () => {
    try {
      // Request permissions
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant permission to save images');
        return;
      }

      // Download the file
      const fileUri = FileSystem.documentDirectory + "temp_image.jpg";
      const { uri } = await FileSystem.downloadAsync(imageUrl, fileUri);
      
      // Save to gallery
      await MediaLibrary.saveToLibraryAsync(uri);
      
      // Clean up the temp file
      await FileSystem.deleteAsync(uri);
      
      Alert.alert('Success', 'Image saved to gallery');
    } catch (error) {
      console.error('Error downloading image:', error);
      Alert.alert('Error', 'Failed to download image');
    }
  };

  const handleShare = async () => {
    try {
      // Download the file first
      const fileUri = FileSystem.documentDirectory + "temp_image.jpg";
      const { uri } = await FileSystem.downloadAsync(imageUrl, fileUri);
      
      // Share the file
      await Sharing.shareAsync(uri);
      
      // Clean up
      await FileSystem.deleteAsync(uri);
    } catch (error) {
      console.error('Error sharing image:', error);
      Alert.alert('Error', 'Failed to share image');
    }
  };

  const handleDeletePost = async () => {
    if (!postId || !user) return;

    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('posts')
                .delete()
                .eq('id', postId)
                .eq('user_id', user.id);

              if (error) throw error;

              Alert.alert('Success', 'Post deleted successfully');
              onClose();
            } catch (error) {
              console.error('Error deleting post:', error);
              Alert.alert('Error', 'Failed to delete post');
            }
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <BlurView intensity={100} tint="dark" className="flex-1 justify-center items-center">
          
          {/* Clickable background to close */}
          <Pressable className="absolute inset-0" onPress={onClose} />

          <View className="w-[80%] bg-white rounded-2xl overflow-hidden shadow-2xl">
            <View>
              {/* Header */}
              <View className="flex-row items-center p-4 border-b border-gray-200">
                <TouchableOpacity onPress={onClose} className="absolute left-2 z-10">
                  <Feather name="x" size={24} color="black" />
                </TouchableOpacity>
                
                <View className="flex-row items-center flex-1 ml-8">
                  {postData?.avatarUrl ? (
                    <Image 
                      source={{ uri: postData.avatarUrl }} 
                      className="w-8 h-8 rounded-full"
                    />
                  ) : (
                    <View className="w-8 h-8 rounded-full bg-gray-200 items-center justify-center">
                      <Feather name="user" size={16} color="black" />
                    </View>
                  )}
                  <View className="ml-3">
                    <Text className="text-black font-semibold">{postData?.username || 'Loading...'}</Text>
                    <Text className="text-gray-500 text-xs">
                      {postData?.timestamp ? formatTimeAgo(postData.timestamp) : ''}
                    </Text>
                  </View>
                </View>
                
                <TouchableOpacity 
                  onPress={() => setShowOptions(true)}
                  className="p-2"
                >
                  <Feather name="more-horizontal" size={24} color="black" />
                </TouchableOpacity>
              </View>

              {/* Image Container */}
              <PinchGestureHandler onGestureEvent={pinchHandler} onHandlerStateChange={(event) => {
                if (event.nativeEvent.state === State.END) {
                  scale.value = withSpring(1);
                }
              }}>
                <Animated.View
                  style={{
                    width: '100%',
                    aspectRatio: originalWidth && originalHeight ? originalWidth / originalHeight : 1,
                    overflow: 'hidden', // Prevent overflow
                    backgroundColor: '#000',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Animated.Image
                    source={{ uri: imageUrl }}
                    style={{
                      width: '100%',
                      height: '100%',
                      transform: [{ scale: scale }],
                    }}
                    resizeMode="contain"
                  />
                </Animated.View>
              </PinchGestureHandler>

              {/* Caption and Comments Section */}
              <ScrollView className="max-h-40 px-4">
                {/* Caption */}
                {postData?.caption && (
                  <View className="flex-row py-2">
                    <Text className="font-semibold mr-2">{postData.username}</Text>
                    <Text>{postData.caption}</Text>
                  </View>
                )}

                {/* Comments */}
                {comments.map((comment) => (
                  <View key={comment.id} className="flex-row py-2">
                    <View className="flex-row flex-1">
                      <Text className="font-semibold mr-2">{comment.user.username}</Text>
                      <Text>{comment.content}</Text>
                    </View>
                    <Text className="text-gray-400 text-xs">
                      {formatTimeAgo(new Date(comment.created_at))}
                    </Text>
                  </View>
                ))}
              </ScrollView>

              {/* Actions */}
              <View className="p-4 border-t border-gray-200">
                <View className="flex-row justify-between mb-4">
                  <View className="flex-row space-x-4">
                    <TouchableOpacity>
                      <Feather name="heart" size={24} color="black" />
                    </TouchableOpacity>
                    <TouchableOpacity>
                      <Feather name="message-circle" size={24} color="black" />
                    </TouchableOpacity>
                    <TouchableOpacity>
                      <Feather name="send" size={24} color="black" />
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity>
                    <Feather name="bookmark" size={24} color="black" />
                  </TouchableOpacity>
                </View>

                {/* Likes */}
                <Text className="text-black font-semibold mb-2">
                  {postData?.likesCount.toLocaleString() || 0} likes
                </Text>

                {/* Add Comment Input */}
                <View className="flex-row items-center border-t border-gray-200 pt-2">
                  <TextInput
                    className="flex-1 px-2 py-1"
                    placeholder="Add a comment..."
                    value={newComment}
                    onChangeText={setNewComment}
                    multiline
                  />
                  <TouchableOpacity 
                    onPress={handleAddComment}
                    disabled={!newComment.trim()}
                  >
                    <Text className={`font-semibold ${
                      newComment.trim() ? 'text-blue-500' : 'text-blue-200'
                    }`}>
                      Post
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>

          {/* Full-Screen Image */}
          {fullScreen && (
            <Pressable 
              className="absolute inset-0 bg-black justify-center items-center"
              onPress={() => setFullScreen(false)}
            >
              <Image
                source={{ uri: imageUrl }}
                style={{
                  width: '100%',
                  height: '100%'
                }}
                resizeMode="contain"
              />
            </Pressable>
          )}

          {/* Options Modal - Move outside the main view but inside BlurView */}
          {showOptions && (
            <View className="absolute inset-0 bg-black/50">
              <Pressable 
                className="flex-1"
                onPress={() => setShowOptions(false)}
              />
              <View className="bg-white rounded-t-3xl">
                <View className="w-12 h-1 bg-gray-300 rounded-full mx-auto my-3" />
                
                {/* Show delete option only if current user is the post owner */}
                {postData?.username === currentUsername && (
                  <TouchableOpacity 
                    onPress={() => {
                      setShowOptions(false);
                      handleDeletePost();
                    }}
                    className="flex-row items-center px-6 py-4 border-b border-gray-200"
                  >
                    <Feather name="trash-2" size={24} color="red" />
                    <Text className="ml-4 text-red-500 font-semibold">Delete Post</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity 
                  onPress={() => {
                    setShowOptions(false);
                    handleDownload();
                  }}
                  className="flex-row items-center px-6 py-4 border-b border-gray-200"
                >
                  <Feather name="download" size={24} color="black" />
                  <Text className="ml-4">Save to Gallery</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  onPress={() => {
                    setShowOptions(false);
                    handleShare();
                  }}
                  className="flex-row items-center px-6 py-4 border-b border-gray-200"
                >
                  <Feather name="share-2" size={24} color="black" />
                  <Text className="ml-4">Share</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  onPress={() => setShowOptions(false)}
                  className="px-6 py-4 mb-6"
                >
                  <Text className="text-center text-gray-500">Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </BlurView>
      </GestureHandlerRootView>
    </Modal>
  );
};

export default ViewImage;
