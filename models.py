import random

class Company:
    def __init__(self, id, name, price, tendency):
        self.id = id
        self.name = name
        self.price = price
        self.tendency = tendency
        self.update_count = 0

    def update_price(self):
        self.update_count += 1
        # Change tendency (-1 ~ 1), clamp to [-10,10]
        self.tendency = max(-10, min(10, self.tendency + random.uniform(-1, 1)))
        # Every 5 updates, damp toward zero by 50%
        if self.update_count % 5 == 0:
            self.tendency *= 0.5
        # If tendency too large, reset
        if abs(self.tendency) > 8:
            self.tendency = 0
        # Apply price change
        factor = random.uniform(0.005, 0.02)
        self.price = max(1, self.price * (1 + self.tendency * factor))

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "price": self.price,
            "tendency": self.tendency
        }

class User:
    def __init__(self, username, balance=1000):
        self.username = username
        self.balance = balance        # starting cash $1000
        self.stocks = {}              # {company id: quantity}

    def buy_stock(self, company, quantity):
        cost = company.price * quantity
        if self.balance >= cost:
            self.balance -= cost
            self.stocks[company.id] = self.stocks.get(company.id, 0) + quantity
            return True, cost
        else:
            return False, cost

    def sell_stock(self, company, quantity):
        held = self.stocks.get(company.id, 0)
        if held >= quantity:
            revenue = company.price * quantity
            self.stocks[company.id] -= quantity
            self.balance += revenue
            return True, revenue
        else:
            return False, 0
