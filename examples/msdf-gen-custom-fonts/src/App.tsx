import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { Container, Text, Fullscreen } from '@react-three/uikit'
import { Html } from '@react-three/drei'
import { useMSDF } from './msdfloader.js'

function Scene() {
  const fontFamilies = useMSDF(
    [
      '/fonts/Inter_18pt-Thin.ttf',
      '/fonts/Inter_24pt-Medium.ttf',
      '/fonts/Inter_28pt-Bold.ttf',
      '/fonts/Inter_28pt-ExtraBold.ttf',
      '/fonts/Inter_18pt-Black.ttf',
    ],
    [{ charset: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789' }],
  )

  return (
    <Fullscreen>
      <Container
        width="100%"
        height="100%"
        flexDirection="column"
        gap={16}
        alignItems="center"
        justifyContent="center"
        fontFamilies={fontFamilies}
      >
        <Text fontFamily="Inter 18pt Thin" fontSize={32} color="white">
          Thin 250
        </Text>
        <Text fontFamily="Inter 24pt Medium" fontSize={32} color="white">
          Medium 500
        </Text>
        <Text fontFamily="Inter 28pt Bold" fontSize={32} color="white">
          Bold 700
        </Text>
        <Text fontFamily="Inter 28pt ExtraBold" fontSize={32} color="white">
          ExtraBold 800
        </Text>
        <Text fontFamily="Inter 18pt Black" fontSize={32} color="white">
          Black 900
        </Text>
      </Container>
    </Fullscreen>
  )
}

function LoadingScreen() {
  return (
    <Html center>
      <div style={{ color: 'white', fontSize: '1.5rem' }}>Loading...</div>
    </Html>
  )
}

export default function App() {
  return (
    <Canvas style={{ height: '100dvh' }}>
      <color attach="background" args={['black']} />
      <Suspense fallback={<LoadingScreen />}>
        <Scene />
      </Suspense>
    </Canvas>
  )
}
