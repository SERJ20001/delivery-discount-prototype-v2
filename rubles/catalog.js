const categories = [
  { name: 'Обувь', items: [
    { id: 'salomon', price: 2000, title: 'Кроссовки Salomon', images: ['f2e61.png', '51e78.png', 'd9ce7.png'], recommendedAmount: 200 },
    { id: 'salomon-grey', price: 3000, title: 'Кроссовки Salomon', images: ['f2e61.png', '51e78.png', 'ce63d.png'], recommendedAmount: 300 },
    { id: 'hiker', price: 4000, title: 'Кроссовки Hiker', images: ['f2e61.png', '51e78.png', '7603d.png'], recommendedAmount: 400 }
  ] },
  { name: 'Постельное бельё', items: [
    { id: 'turquoise', price: 500, title: 'Постельное бельё ИКЕА Бирюза', images: ['f2e61.png', '51e78.png'], recommendedAmount: 150 },
    { id: 'ocean', price: 5000, title: 'Постельное бельё ИКЕА Океан', images: ['f2e61.png', 'c318d.png'], recommendedAmount: 500 },
    { id: 'rose', price: 5000, title: 'Постельное бельё ИКЕА Роза', images: ['f2e61.png', '81bf5.png'], recommendedAmount: 500 },
    { id: 'carrots', price: 4000, title: 'Постельное бельё ИКЕА Морковки', images: ['f2e61.png', '7ea8d.png'], recommendedAmount: 400 }
  ] },
  { name: 'Электроника', items: [
    { id: 'iphone', price: 50000, title: 'iPhone 16', images: ['77eb1.png'], recommendedAmount: 600 },
    { id: 'ipad', price: 30000, title: 'iPad mini', images: ['ba80b.png'], recommendedAmount: 600 },
    { id: 'mouse', price: 4000, title: 'Мышка apple', images: ['e90cc.png'], recommendedAmount: 400 }
  ] }
];

const previousItem = { id: 'lime', price: 3000, title: 'Кроссовки Lime', images: ['92bb0.png'], recommendedAmount: 300 };

const pricePreviousItem = { id: 'v4-sneakers', price: 3400, title: 'Бежевые кеды', images: ['92bb0.png'] };
const priceItems = [
  ['mug', 350, 'Керамическая кружка'],
  ['book', 500, 'Книга «Северный ветер»'],
  ['basket', 690, 'Плетёная корзина'],
  ['scarf', 890, 'Хлопковый шарф'],
  ['lamp', 1000, 'Настольная лампа'],
  ['dumbbells', 1900, 'Гантели, 2 шт.'],
  ['backpack', 2500, 'Городской рюкзак'],
  ['keyboard', 3000, 'Механическая клавиатура'],
  ['headphones', 5500, 'Беспроводные наушники'],
  ['lens', 8900, 'Зум-объектив'],
  ['espresso', 10000, 'Рожковая кофеварка'],
  ['tablet', 18500, 'Планшет в чехле'],
  ['camera', 26000, 'Беззеркальный фотоаппарат'],
  ['bicycle', 30000, 'Городской велосипед'],
  ['laptop', 47000, 'Ноутбук 14″'],
  ['piano', 69000, 'Цифровое пианино']
].map(([name, price, title]) => ({ id: `v4-${name}`, price, title, images: [`v4-${name}.png`] }));

const priceCategories = [
  { name: 'До 1 000 ₽', from: 0, to: 1000 },
  { name: '1 000 – 3 000 ₽', from: 1000, to: 3000 },
  { name: '3 000 – 10 000 ₽', from: 3000, to: 10000 },
  { name: '10 000 – 30 000 ₽', from: 10000, to: 30000 },
  { name: 'От 30 000 ₽', from: 30000, to: Infinity }
].map(({ name, from, to }) => ({
  name,
  items: [...priceItems, pricePreviousItem]
    .filter(item => item.price >= from && item.price < to)
    .sort((left, right) => left.price - right.price)
}));

const priceInventory = [...priceItems, pricePreviousItem];
const departmentItems = [
  ['Дом и интерьер', ['mug', 'basket', 'lamp', 'espresso']],
  ['Книги и музыка', ['book', 'piano']],
  ['Одежда и аксессуары', ['scarf', 'backpack', 'sneakers']],
  ['Спорт', ['dumbbells', 'bicycle']],
  ['Электроника', ['keyboard', 'headphones', 'lens', 'tablet', 'camera', 'laptop']]
].map(([name, ids]) => ({
  name,
  items: ids.map(id => priceInventory.find(item => item.id === 'v4-' + id))
}));
