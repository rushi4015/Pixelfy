import { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Animated,
  TouchableOpacity,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Easing,
  StyleSheet,
  BackHandler,
} from "react-native";
import { supabase } from "~/lib/supabase";
import { useFocusEffect, useRouter } from "expo-router";
import StoryList from "~/app/story/StoryList";
import PostListItem from "~/Components/PostListItem";
import { useFonts } from "expo-font";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useAuth } from "~/providers/AuthProvider";
import { LikeButton } from '~/Components/LikeButton';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import BottomSheet from '@gorhom/bottom-sheet';
import LikesBottomSheet from '~/Components/LikesBottomSheet';
import CommentBottomSheet from '~/Components/CommentBottomSheet';

const PAGE_SIZE = 5;

export default function FeedScreen() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  const { user, username } = useAuth();
  const [hasUnseenNotifications, setHasUnseenNotifications] = useState(false);
  const [likesPopupVisible, setLikesPopupVisible] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [commentsPopupVisible, setCommentsPopupVisible] = useState(false);
  const [selectedCommentPostId, setSelectedCommentPostId] = useState<string | null>(null);
  const [storyRefreshing, setStoryRefreshing] = useState(false);

  const scrollY = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);
  const headerTranslateY = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const iconAnim = useRef(new Animated.Value(1)).current;
  const ringAnim = useRef(new Animated.Value(0)).current;

  const [fontsLoaded] = useFonts({
    "OnryDisplay-Bold": require("~/../assets/fonts/nicolassfonts-onrydisplay-extrabold.otf"),
  });

  const sheetRef = useRef<BottomSheet>(null);
  const commentSheetRef = useRef<BottomSheet>(null);

  const fetchPosts = async (reset = false) => {
    setLoading(true);
    let query = supabase
      .from("posts")
      .select("*, user:users (username, avatar_url, verified, is_private)")
      .order("created_at", { ascending: false });

    if (user) {
      query = query.neq("user_id", user.id);
    }

    if (user?.is_private) {
      query = query.eq("users.is_private", false);
    } else {
      query = query.eq("users.is_private", false);
    }

    const { data, error } = await query;

    if (error) {
      Alert.alert("Error", error.message);
      console.error("Supabase Fetch Error:", error);
      setLoading(false);
      return;
    }

    setPosts(data);
    setLoading(false);
  };

  useFocusEffect(
    useCallback(() => {
      if (!user || !username) {
        router.replace("/(screens)/user_info");
        return;
      }

      let isActive = true;

      const fetchData = async () => {
        try {
          await fetchPosts(true);
        } catch (error) {
          console.error("Fetch error:", error);
        }
      };

      if (isActive) {
        fetchData();
      }

      return () => {
        isActive = false;
      };
    }, [user, username])
  );

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        return true;
      };

      BackHandler.addEventListener('hardwareBackPress', onBackPress);

      return () => {
        BackHandler.removeEventListener('hardwareBackPress', onBackPress);
      };
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    setStoryRefreshing(true);
    
    // Refresh all components
    await Promise.all([
      fetchPosts(true),
      checkUnseenNotifications(),
    ]);
    
    // Force update the post list items by resetting the posts state
    setPosts(prevPosts => [...prevPosts]);
    
    setRefreshing(false);
    setStoryRefreshing(false);
  };

  const handleNotificationPress = () => {
    router.push("/notification");
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const currentScrollY = event.nativeEvent.contentOffset.y;
    const scrollDifference = currentScrollY - lastScrollY.current;

    if (currentScrollY <= 0) {
      Animated.timing(headerTranslateY, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else if (scrollDifference > 5) {
      Animated.timing(headerTranslateY, {
        toValue: -60,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else if (scrollDifference < -5) {
      Animated.timing(headerTranslateY, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }

    lastScrollY.current = currentScrollY;
  };

  const checkUnseenNotifications = async () => {
    try {
      if (!user) {
        setHasUnseenNotifications(false);
        return;
      }

      const { data, error } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', user.id)
        .eq('seen', false)
        .limit(1);

      if (!error) {
        setHasUnseenNotifications(data.length > 0);
      }
    } catch (error) {
      console.error('Error checking unseen notifications:', error);
      setHasUnseenNotifications(false);
    }
  };

  useEffect(() => {
    if (user) {
      checkUnseenNotifications();
      
      // Set up realtime subscription
      const subscription = supabase
        .channel('notifications')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        }, (payload) => {
          // Only trigger animation if the new notification is unseen
          if (payload.new && payload.new.seen === false) {
            checkUnseenNotifications();
          }
        })
        .subscribe();

      return () => {
        supabase.removeChannel(subscription);
      };
    } else {
      setHasUnseenNotifications(false);
    }
  }, [user]);

  // Only start animations if user is logged in and has unseen notifications
  useEffect(() => {
    if (user && hasUnseenNotifications) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [hasUnseenNotifications, user]);

  useEffect(() => {
    if (user && hasUnseenNotifications) {
      const shake = Animated.loop(
        Animated.sequence([
          Animated.timing(iconAnim, {
            toValue: 1.1,
            duration: 200,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(iconAnim, {
            toValue: 0.9,
            duration: 200,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(iconAnim, {
            toValue: 1,
            duration: 200,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
        ])
      );
      shake.start();
      return () => shake.stop();
    } else {
      iconAnim.setValue(1);
    }
  }, [hasUnseenNotifications, user]);

  useEffect(() => {
    if (user && hasUnseenNotifications) {
      const ring = Animated.loop(
        Animated.sequence([
          // First swing
          Animated.timing(ringAnim, {
            toValue: 1,
            duration: 200,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(ringAnim, {
            toValue: -1,
            duration: 200,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(ringAnim, {
            toValue: 0,
            duration: 200,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          // Pause
          Animated.delay(1000), // 1 second pause
          // Second swing
          Animated.timing(ringAnim, {
            toValue: 1,
            duration: 200,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(ringAnim, {
            toValue: -1,
            duration: 200,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(ringAnim, {
            toValue: 0,
            duration: 200,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          // Longer pause
          Animated.delay(2000), // 2 second pause
        ])
      );
      ring.start();
      return () => ring.stop();
    } else {
      ringAnim.setValue(0); // Reset animation when no unseen notifications
    }
  }, [hasUnseenNotifications, user]);

  const rotateInterpolate = ringAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-15deg', '0deg', '15deg']
  });

  const handleLikeButtonPress = (postId: string) => {
    setSelectedPostId(postId);
    setLikesPopupVisible(true);
    setTimeout(() => {
      sheetRef.current?.snapToIndex(0);
    }, 10);
  };

  const handleCommentPress = useCallback((postId: string) => {
    setSelectedCommentPostId(postId);
    setCommentsPopupVisible(true);
  }, []);

  if (!fontsLoaded) {
    return <ActivityIndicator size="large" color="#000" />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View className="flex-1 bg-gray-100">
        {/* Fixed Header */}
        <Animated.View
          style={{
            transform: [{ translateY: headerTranslateY }],
            height: 50,
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            backgroundColor: "white",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingHorizontal: 16,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 4,
            elevation: 3,
            zIndex: 10,
          }}
        >
          <Text style={{ fontSize: 24, fontFamily: "OnryDisplay-Bold" }}>Pixelfy</Text>
          <TouchableOpacity onPress={handleNotificationPress} activeOpacity={1}>
            <View className="relative">
              <Animated.View 
                style={{
                  transform: [
                    { rotate: rotateInterpolate },
                    { perspective: 1000 }
                  ]
                }}
              >
                <Ionicons name="notifications" size={28} color="black" />
              </Animated.View>
              {hasUnseenNotifications && (
                <View className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* Content */}
        <View className="flex-1 bg-gray-100 pb-0">
          {loading && posts.length === 0 ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color="#000" />
            </View>
          ) : (
            <FlatList
              data={posts}
              keyExtractor={(item, index) => (item.id ? item.id.toString() : `post-${index}`)}
              renderItem={({ item }) => (
                <PostListItem 
                  post={item} 
                  onLikePress={() => handleLikeButtonPress(item.id)}
                  onShowLikes={handleLikeButtonPress}
                  onComment={handleCommentPress}
                />
              )}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              contentContainerStyle={{ paddingTop: 50 }}
              ListHeaderComponent={
                <View className="bg-white">
                  <StoryList refreshing={storyRefreshing} />
                </View>
              }
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={["#000000"]}
                  tintColor="#000000"
                  progressViewOffset={30}
                />
              }
            />
          )}
        </View>

        {/* Only render LikesBottomSheet when likesPopupVisible is true */}
        {likesPopupVisible && (
          <LikesBottomSheet
            postId={selectedPostId}
            sheetRef={sheetRef}
            visible={likesPopupVisible}
            onClose={() => {
              setLikesPopupVisible(false);
              setSelectedPostId(null);
            }}
          />
        )}

        {/* Comments Bottom Sheet */}
        {commentsPopupVisible && (
          <CommentBottomSheet
            postId={selectedCommentPostId}
            sheetRef={commentSheetRef}
            visible={commentsPopupVisible}
            onClose={() => {
              setCommentsPopupVisible(false);
              setSelectedCommentPostId(null);
            }}
          />
        )}
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});
