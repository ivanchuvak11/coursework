import React, { useEffect } from 'react';
import './LandingPage.css';

export default function LandingPage() {
    useEffect(() => {
        // Скрипти для меню
        const handleMenuToggle = () => {
            const body = document.body;
            const menu = document.getElementById('menu');
            const pageWrapper = document.getElementById('page-wrapper');
            
            if (body.classList.contains('is-menu-visible')) {
                body.classList.remove('is-menu-visible');
                if (pageWrapper) pageWrapper.style.filter = '';
            } else {
                body.classList.add('is-menu-visible');
                if (pageWrapper) pageWrapper.style.filter = 'blur(1.5px)';
            }
        };

        const closeMenu = () => {
            document.body.classList.remove('is-menu-visible');
            const pageWrapper = document.getElementById('page-wrapper');
            if (pageWrapper) pageWrapper.style.filter = '';
        };

        const menuLink = document.querySelector('#header nav a');
        const closeBtn = document.querySelector('#menu .close');
        
        if (menuLink) menuLink.addEventListener('click', handleMenuToggle);
        if (closeBtn) closeBtn.addEventListener('click', closeMenu);

        return () => {
            if (menuLink) menuLink.removeEventListener('click', handleMenuToggle);
            if (closeBtn) closeBtn.removeEventListener('click', closeMenu);
        };
    }, []);

    return (
        <div id="page-wrapper">
            {/* Header */}
            <header id="header">
                <h1><a href="/">Solid State</a></h1>
                <nav>
                    <a href="#menu">Menu</a>
                </nav>
            </header>

            {/* Menu */}
            <nav id="menu">
                <div className="inner">
                    <h2>Menu</h2>
                    <ul className="links">
                        <li><a href="/">Home</a></li>
                        <li><a href="/orders"> Замовлення</a></li>
                        <li><a href="/new-order"> Нове замовлення</a></li>
                        <li><a href="/parts"> Деталі</a></li>
                        <li><a href="/login"> Log In</a></li>
                    </ul>
                    <a href="#" className="close">Close</a>
                </div>
            </nav>

            {/* Wrapper */}
            <section id="wrapper">
                <header>
                    <div className="inner">
                        <h2>Система управління ремонтною майстернею</h2>
                        <p>Професійний ремонт електроніки з гарантією якості</p>
                    </div>
                </header>

                {/* Content */}
                <div className="wrapper">
                    <div className="inner">
                        <h3 className="major">Про нашу майстерню</h3>
                        <p>Ми спеціалізуємося на ремонті сучасної електроніки: смартфонів, ноутбуків, планшетів та інших пристроїв. Наша команда професійних майстрів використовує тільки оригінальні запчастини та сучасне діагностичне обладнання. Кожен пристрій проходить ретельну перевірку перед видачею клієнту.</p>

                        <p>Наша система управління дозволяє відстежувати кожен етап ремонту: від прийому замовлення до видачі готового пристрою. Ви завжди можете перевірити статус вашого ремонту онлайн та отримувати SMS-сповіщення про зміну статусу.</p>

                        <h3 className="major">Наші послуги</h3>
                        <section className="features">
                            <article>
                                <div className="image">
                                    <img src="https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?w=400&h=300&fit=crop" alt="Ремонт смартфонів" />
                                </div>
                                <h3 className="major">Ремонт смартфонів</h3>
                                <p>Заміна дисплеїв, акумуляторів, роз'ємів, динаміків, мікрофонів та інших компонентів будь-якої складності.</p>
                                <a href="/new-order" className="special">Замовити ремонт</a>
                            </article>
                            <article>
                                <div className="image">
                                    <img src="https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=400&h=300&fit=crop" alt="Ремонт ноутбуків" />
                                </div>
                                <h3 className="major">Ремонт ноутбуків</h3>
                                <p>Відновлення живлення, заміна матриць, клавіатур, чищення від пилу, заміна термопасти.</p>
                                <a href="/new-order" className="special">Замовити ремонт</a>
                            </article>
                        </section>

                        <h3 className="major">Чому обирають нас?</h3>
                        <div className="row" style={{ marginBottom: '2em' }}>
                            <div className="col-4" style={{ textAlign: 'center' }}>
                                <span className="icon solid fa-check-circle" style={{ fontSize: '3em', color: '#4c5c96' }}></span>
                                <h4>Гарантія якості</h4>
                                <p>6 місяців гарантії на всі види робіт</p>
                            </div>
                            <div className="col-4" style={{ textAlign: 'center' }}>
                                <span className="icon solid fa-clock" style={{ fontSize: '3em', color: '#4c5c96' }}></span>
                                <h4>Швидкий ремонт</h4>
                                <p>Більшість ремонтів за 1-2 дні</p>
                            </div>
                            <div className="col-4" style={{ textAlign: 'center' }}>
                                <span className="icon solid fa-shield-alt" style={{ fontSize: '3em', color: '#4c5c96' }}></span>
                                <h4>Оригінальні деталі</h4>
                                <p>Тільки якісні запчастини</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <section id="footer">
                <div className="inner">
                    <h2 className="major">Зв'язатися з нами</h2>
                    <p>Маєте питання? Залиште повідомлення або зателефонуйте нам. Ми відповімо протягом 15 хвилин у робочий час.</p>
                    <form method="post" action="#">
                        <div className="fields">
                            <div className="field">
                                <label htmlFor="name">Ім'я</label>
                                <input type="text" name="name" id="name" />
                            </div>
                            <div className="field">
                                <label htmlFor="email">Email</label>
                                <input type="email" name="email" id="email" />
                            </div>
                            <div className="field">
                                <label htmlFor="message">Повідомлення</label>
                                <textarea name="message" id="message" rows="4"></textarea>
                            </div>
                        </div>
                        <ul className="actions">
                            <li><input type="submit" value="Надіслати повідомлення" /></li>
                        </ul>
                    </form>
                    <ul className="contact">
                        <li className="icon solid fa-home">
                            Ремонтна майстерня<br />
                            м. Київ, вул. Хрещатик, 15<br />
                            Україна
                        </li>
                        <li className="icon solid fa-phone">(044) 123-45-67</li>
                        <li className="icon solid fa-envelope"><a href="#">info@repair-workshop.ua</a></li>
                        <li className="icon brands fa-telegram"><a href="#">t.me/repair_workshop</a></li>
                        <li className="icon brands fa-viber"><a href="#">viber.com/repair_workshop</a></li>
                        <li className="icon brands fa-instagram"><a href="#">instagram.com/repair_workshop</a></li>
                    </ul>
                    <ul className="copyright">
                        <li>&copy; Ремонтна майстерня. Всі права захищені.</li>
                        <li>Design: <a href="http://html5up.net">HTML5 UP</a></li>
                    </ul>
                </div>
            </section>
        </div>
    );
}