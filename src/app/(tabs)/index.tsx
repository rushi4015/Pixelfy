import { useState, useRef } from "react";
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
} from "react-native";
import { supabase } from "~/src/lib/supabase";
import { useFocusEffect, useRouter } from "expo-router";
import PostListItem from "~/src/Components/PostListItem";
import { useFonts } from "expo-font";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useAuth } from "~/src/providers/AuthProvider";

const PAGE_SIZE = 5;

export default function FeedScreen() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastPostId, setLastPostId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const router = useRouter();
  const { user, username } = useAuth();

  const scrollY = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);
  const headerTranslateY = useRef(new Animated.Value(0)).current;
  const notificationScale = useRef(new Animated.Value(1)).current;

  const [fontsLoaded] = useFonts({
    "OnryDisplay-Bold": require("~/assets/fonts/nicolassfonts-onrydisplay-extrabold.otf"),
  });

  const fetchPosts = async (reset = false) => {
    if (!hasMore && !reset) return;

    setLoading(true);
    const query = supabase
      .from("posts")
      .select("*, user:users (username, avatar_url, verified)")
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);

    if (!reset && lastPostId) {
      query.lt("id", lastPostId);
    }

    const { data, error } = await query;

    if (error) {
      Alert.alert("Error", error.message);
      console.error("Supabase Fetch Error:", error);
      setLoading(false);
      return;
    }

    if (data.length > 0) {
      setLastPostId(data[data.length - 1].id);
    }

    setPosts((prev) => {
      const newPosts = reset ? data : [...prev, ...data];
      return Array.from(new Map(newPosts.map((post) => [post.id, post])).values());
    });

    setHasMore(data.length === PAGE_SIZE);
    setLoading(false);
  };

  useFocusEffect(() => {
    if (!user || !username) {
      router.replace("/(screens)/user_info");
      return;
    }
    fetchPosts(true);
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPosts(true);
    setRefreshing(false);
  };

  const handleNotificationPress = () => {
    router.push("/(screens)/notifications");
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const currentScrollY = event.nativeEvent.contentOffset.y;
    const scrollDifference = currentScrollY - lastScrollY.current;
  
    if (currentScrollY <= 0) {
      // Ensure the header stays visible when at the very top
      Animated.timing(headerTranslateY, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else if (scrollDifference > 5) {
      // Scrolling Down - Hide Header
      Animated.timing(headerTranslateY, {
        toValue: -60,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else if (scrollDifference < -5) {
      // Scrolling Up - Show Header
      Animated.timing(headerTranslateY, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  
    lastScrollY.current = currentScrollY;
  };
  

  if (!fontsLoaded) {
    return <ActivityIndicator size="large" color="#000" />;
  }

  return (
    <View className="flex-1 bg-gray-100">
      {/* Fixed Header */}
      <Animated.View
        style={{
          transform: [{ translateY: headerTranslateY }],
          height: 60,
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
          <Ionicons name="notifications" size={28} color="black" />
        </TouchableOpacity>
      </Animated.View>

      {/* Content */}
      {loading && posts.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#000" />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item, index) => (item.id ? item.id.toString() : `post-${index}`)}
          renderItem={({ item }) => <PostListItem post={item} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          onScroll={handleScroll} // Detect scroll up/down movement
          scrollEventThrottle={16} // Ensures smooth scroll event handling
          contentContainerStyle={{ paddingTop: 60 }}
        />
      )}
    </View>
  );
}
