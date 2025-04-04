import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Text, View, TouchableOpacity, useWindowDimensions, Image, ActivityIndicator } from "react-native";
import { Ionicons, AntDesign, Feather, Entypo } from '@expo/vector-icons';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { formatDistanceToNow } from "date-fns";
import Animated, { 
  useAnimatedStyle, 
  withSpring, 
  withSequence, 
  withTiming,
  interpolate,
  useSharedValue,
  Easing,
  runOnJS
} from 'react-native-reanimated';
import { handleLike, LikeButton, checkIfLiked } from './LikeButton';
import { useAuth } from '~/providers/AuthProvider';
import { supabase } from '~/lib/supabase';
import { StyleSheet } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import BottomSheet, { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import LikesBottomSheet from './LikesBottomSheet';

interface User {
  id: string; // UUID
  username: string;
  full_name: string;
  avatar_url: string | null;
  verified: boolean;
  is_private: boolean;
  // Other fields are not needed in this component
}

interface Post {
  id: string; // UUID
  user_id: string; // UUID
  caption: string | null;
  media_url: string;
  media_type: string;
  created_at: string;
  user: User;
  // Add likes count from the likes table
  likes_count?: number;
}

interface PostListItemProps {
  post: Post;
  onLike?: (postId: string) => void;
  onComment?: (postId: string) => void;
  onShare?: (postId: string) => void;
  onBookmark?: (postId: string) => void;
  onProfilePress?: (userId: string) => void;
  currentUserId?: string;
  onShowLikes: (postId: string) => void;
}

export default function PostListItem({ 
  post,
  onLike,
  onComment,
  onShare,
  onBookmark,
  onProfilePress,
  currentUserId,
  onShowLikes
}: PostListItemProps) {
  const { width } = useWindowDimensions();
  const [avatarError, setAvatarError] = useState(false);
  const [liked, setLiked] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  const [lastTap, setLastTap] = useState(0);
  const heartScale = useSharedValue(0);
  const likeScale = useSharedValue(1);
  const contentOpacity = useSharedValue(0);

  const { user } = useAuth();

  const [likeCount, setLikeCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);

  const avatarUrl = useMemo(() => {
    return post.user?.avatar_url && !avatarError
      ? `${post.user.avatar_url}?t=${Date.now()}`
      : null;
  }, [post.user?.avatar_url, avatarError]);

  const timeAgo = useMemo(() => {
    return formatDistanceToNow(new Date(post.created_at), { addSuffix: true });
  }, [post.created_at]);

  // Add useEffect to refresh counters when post prop changes
  useEffect(() => {
    const fetchCounters = async () => {
      try {
        // Fetch like count
        const { count: likeCount, error: likeError } = await supabase
          .from('likes')
          .select('*', { count: 'exact', head: true })
          .eq('post_id', post.id);

        if (!likeError) {
          setLikeCount(likeCount || 0);
        }

        // Fetch comment count
        const { count: commentCount, error: commentError } = await supabase
          .from('comments')
          .select('*', { count: 'exact', head: true })
          .eq('post_id', post.id);

        if (!commentError) {
          setCommentCount(commentCount || 0);
        }

        // Check if the post is liked
        if (user) {
          const isLiked = await checkIfLiked(post.id, user.id);
          setLiked(isLiked);
        }
      } catch (error) {
        console.error('Error fetching counters:', error);
      }
    };

    fetchCounters();
  }, [post.id, user?.id]);

  const handleLikePress = async () => {
    if (!user) {
      console.error('User is not authenticated');
      return; // Exit if user is not defined
    }

    try {
      const newLikedState = await handleLike({
        postId: post.id,
        postUserId: post.user_id,
        isLiked: liked,
        onLikeChange: (newState) => {
          setLiked(newState);
          // Update local like count
          setLikeCount(prev => newState ? prev + 1 : Math.max(prev - 1, 0));
          onLike?.(post.id);
        },
        userId: user.id
      });
      setLiked(newLikedState);
    } catch (error) {
      console.error('Error handling like:', error);
    }
  };

  const handleProfilePress = useCallback(() => {
    onProfilePress?.(post.user_id);
  }, [post.user_id, onProfilePress]);

  // Animation styles
  const heartAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
    opacity: heartScale.value,
  }));

  const likeButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: likeScale.value }],
  }));

  const contentAnimatedStyle = useAnimatedStyle(() => ({
    opacity: withTiming(1, { duration: 300 }),
    transform: [
      { 
        translateY: interpolate(
          contentOpacity.value,
          [0, 1],
          [10, 0]
        )
      }
    ],
  }));

  React.useEffect(() => {
    contentOpacity.value = 1;
  }, []);

  const [isCommentsVisible, setIsCommentsVisible] = useState(false);

  const handleCommentPress = useCallback(() => {
    onComment?.(post.id);
  }, [onComment, post.id]);

  const handleDoubleTapLike = useCallback(async () => {
    if (!liked) {
      try {
        // Show and animate the heart overlay
        heartScale.value = 0;
        heartScale.value = withSequence(
          withSpring(1, { damping: 4 }),
          withTiming(1, { duration: 500 }),
          withTiming(0, { duration: 200 })
        );

        // Call the like handler
        await handleLikePress();
      } catch (error) {
        console.error('Error during double tap like:', error);
      }
    }
  }, [liked, post.id, post.user_id, onLike, user.id]);

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onStart(() => {
      runOnJS(handleDoubleTapLike)(); // Use runOnJS to ensure it runs on the JS thread
    });

  const handleLikeCountPress = useCallback(() => {
    onShowLikes(post.id);
  }, [post.id, onShowLikes]);

  if (!post) {
    return (
      <View className="p-4">
        <ActivityIndicator size="small" color="#0000ff" />
      </View>
    );
  }

  return (
    <View>
      <Animated.View className="bg-white" style={contentAnimatedStyle}>
        {/* Header */}
        <TouchableOpacity 
          className="px-4 py-3 flex-row items-center justify-between"
          onPress={handleProfilePress}
        >
          <View className="flex-row items-center">
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                className="w-9 h-9 rounded-full border border-gray-100"
                onError={() => setAvatarError(true)}
              />
            ) : (
              <View className="w-9 h-9 rounded-full bg-gray-50 items-center justify-center border border-gray-100">
               <FontAwesome name="user" size={24} color="gray" />
              </View>
            )}
            <View className="ml-3">
              <Text className="font-semibold text-[14px]">
                {post.user.username}
                {post.user.verified && (
                  <Ionicons name="checkmark-circle" size={14} color="#3897F0" style={{ marginLeft: 4 }} />
                )}
              </Text>
              <Text className="text-xs text-gray-500">{timeAgo}</Text>
            </View>
          </View>
          <TouchableOpacity className="p-2">
            <Feather name="more-horizontal" size={20} color="#262626" />
          </TouchableOpacity>
        </TouchableOpacity>

        {/* Image with double tap to like */}
        <GestureDetector gesture={doubleTapGesture}>
          <TouchableOpacity activeOpacity={1}>
            <View className="relative">
              <Image
                source={{ uri: post.media_url || 'https://via.placeholder.com/500' }}
                className="w-full bg-gray-100"
                style={{ height: width, aspectRatio: 1 }}
                onError={() => setImageError(true)}
              />
              <Animated.View 
                className="absolute inset-0 items-center justify-center pointer-events-none"
                style={heartAnimatedStyle}
              >
                <AntDesign name="heart" size={80} color="white" />
              </Animated.View>
            </View>
          </TouchableOpacity>
        </GestureDetector>

        {/* Actions */}
        <View className="px-4 pt-3 pb-1">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-4">
              <TouchableOpacity 
                onPress={handleLikePress}
                className="active:opacity-60 flex-row items-center gap-2"
              >
                <LikeButton isLiked={liked} />
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={handleLikeCountPress}
                className="active:opacity-60"
              >
                <Text className="text-sm font-semibold text-gray-800">
                  {likeCount} likes
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={handleCommentPress}
                className="active:opacity-60 flex-row items-center gap-2"
              >
                <Feather name="message-circle" size={26} color="#262626" />
                <Text className="text-sm font-semibold text-gray-800">{commentCount}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => onShare?.(post.id)}
                className="active:opacity-60"
              >
                <Animated.View>
                  <Feather name="send" size={24} color="#262626" />
                </Animated.View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Likes & Caption */}
          <View className="mt-2">
            <Text className="font-semibold text-[14px]">
              {liked ? "You and " : ""}{likeCount} {likeCount === 1 ? 'like' : 'likes'}
            </Text>
            {post.caption && (
              <Text className="text-[14px] leading-5 mt-1">
                <Text className="font-semibold">{post.user.username} </Text>
                <Text className="ml-1">{post.caption}</Text>
              </Text>
            )}
          </View>

          {/* Add Comment Button */}
          <TouchableOpacity 
            onPress={handleCommentPress}
            className="mt-2 mb-1"
          >
            <Text className="text-gray-500 text-sm">Add a comment...</Text>
          </TouchableOpacity>
        </View>

        {/* Separator */}
        <View className="h-[1px] bg-gray-100 mt-1" />
      </Animated.View>
    </View>
  );
}

// Add these styles
const styles = StyleSheet.create({
  likeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  contentContainer: {
    paddingBottom: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
});