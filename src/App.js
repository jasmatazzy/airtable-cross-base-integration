import React from "react";
import { useState, useEffect } from "react";
import "./App.css";
import UserInterface from "./components/UserInterface/UserInterface";
// import FuzzySearchDropdown from "./components/FuzzySearchDropdown/FuzzySearchDropdown";


function App() {


//   useEffect(() => {
//   }, []);


  return (
    <div className="App">
      <UserInterface />
    </div>
  );
}

export default App;