import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Помилка сторінки:', error, info);
  }

  componentDidUpdate(previousProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="page-error">
          <h2>Не вдалося відкрити сторінку</h2>
          <p>Спробуйте оновити сторінку або повернутись до списку замовлень.</p>
          <button type="button" onClick={() => this.setState({ error: null })}>
            Спробувати ще раз
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
