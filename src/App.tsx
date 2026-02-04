import Footer from "./components/Footer";
import Header from "./components/Header";
import Home from "./page/Home";

function App() {
  return (
    <div className="wrap">
      <Header />
      <main>
        <Home />
      </main>
      <Footer />
    </div>
  );
}

export default App;
