import router from './router';
import { RouterProvider } from 'react-router-dom';
import { SoundProvider } from './contexts/SoundContext';

function App() {
  return (
    <SoundProvider>
      <RouterProvider router={router} />
    </SoundProvider>
  )
}
export default App