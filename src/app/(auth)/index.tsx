import React, { useState } from 'react'
import { Alert, StyleSheet, View, TextInput } from 'react-native'
import { supabase } from '~/src/lib/supabase'
import Button from '~/src/Components/Button'
import { useAuth } from '~/src/providers/AuthProvider' // Import useAuth to trigger session update
import { router } from 'expo-router' // Import router from expo-router for navigation

export default function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const { session, setSession } = useAuth() // Access the Auth context

  async function signInWithEmail() {
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    })

    if (error) {
      Alert.alert(error.message)
    } else {
      // Manually update session after sign-in
      const { data: { session } } = await supabase.auth.getSession()
      setSession(session)  // Ensure session is updated in context
      console.log("Signin successful!")
      // Redirect to index (feed) page after successful sign in
      router.push('/(tabs)/index')
    }
    setLoading(false)
  }

  async function signUpWithEmail() {
    setLoading(true)
    const {
      data: { session },
      error,
    } = await supabase.auth.signUp({
      email: email,
      password: password,
    })

    if (error) {
      Alert.alert(error.message)
    } else if (!session) {
      // If no session is returned, alert the user to verify their email
      Alert.alert(
        'Sign Up Successful',
        'Please check your inbox for email verification. Once verified, you will be redirected to your profile.',
        [{ text: 'OK', onPress: () => router.push('/(tabs)/profile') }]
      )
    } else {
      // On successful sign up (session exists), update the context and redirect to profile
      setSession(session)
      console.log("Signup successful!")
      router.push('/(tabs)/profile')
    }
    setLoading(false)
  }

  return (
    <View style={styles.container}>
      <View style={[styles.verticallySpaced, styles.mt20]}>
        <TextInput
          onChangeText={(text) => setEmail(text)}
          value={email}
          placeholder="email@address.com"
          autoCapitalize={'none'}
          className='border border-gray-300 p-3 rounded-lg'
        />
      </View>
      <View style={styles.verticallySpaced}>
        <TextInput
          onChangeText={(text) => setPassword(text)}
          value={password}
          secureTextEntry={true}
          placeholder="Password"
          autoCapitalize={'none'}
          className='border border-gray-300 p-3 rounded-lg'
        />
      </View>
      <View style={[styles.verticallySpaced, styles.mt20]}>
        <Button title="Sign in" disabled={loading} onPress={() => signInWithEmail()} />
      </View>
      <View style={styles.verticallySpaced}>
        <Button title="Sign up" disabled={loading} onPress={() => signUpWithEmail()} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginTop: 40,
    padding: 12,
  },
  verticallySpaced: {
    paddingTop: 4,
    paddingBottom: 4,
    alignSelf: 'stretch',
  },
  mt20: {
    marginTop: 20,
  },
})
