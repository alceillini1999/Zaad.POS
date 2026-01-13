// zaad-bakery/frontend/src/ErrorBoundary.jsx
import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // يسجل الخطأ في الـConsole مع التفاصيل
    console.error("UI crash:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, fontFamily: "system-ui" }}>
          <h2>حدث خطأ غير متوقع في الواجهة</h2>
          <p>جرّب تحديث الصفحة. إن استمر، أرسل لنا لقطة شاشة من Console.</p>
        </div>
      );
    }
    return this.props.children;
  }
}
