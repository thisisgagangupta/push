import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";

const PharmacyBillingMobile = ({
  items,
  medicines,
  handleMedicineChange,
  handlePriceChange,
  handleQuantityChange,
  handleDiscountChange,
  removeItem,
  calculateItemTotal,
  addItem,
  submitting,
}) => {
  const [expandedItem, setExpandedItem] = React.useState(0);

  const toggleExpand = (index) => {
    setExpandedItem(expandedItem === index ? -1 : index);
  };

  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <Card key={index} className="overflow-hidden">
          <div
            className="flex justify-between items-center p-4 cursor-pointer bg-secondary/30"
            onClick={() => toggleExpand(index)}
          >
            <div>
              <h4 className="font-medium">{item.medicine}</h4>
              <p className="text-sm text-muted-foreground">
                {item.quantity} × ₹{item.price.toFixed(2)}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <span className="font-semibold">
                ₹
                {calculateItemTotal(
                  item.price,
                  item.quantity,
                  item.discount
                ).toFixed(2)}
              </span>
              {expandedItem === index ? (
                <ChevronUp size={18} />
              ) : (
                <ChevronDown size={18} />
              )}
            </div>
          </div>

          {expandedItem === index && (
            <CardContent className="pt-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor={`medicine-${index}`}>Medicine</Label>
                  <select
                    id={`medicine-${index}`}
                    className="w-full p-2 mt-1 rounded-md border border-input"
                    value={item.medicine}
                    onChange={(e) =>
                      handleMedicineChange(index, e.target.value)
                    }
                    disabled={submitting}
                  >
                    {medicines.map((medicine) => (
                      <option
                        key={medicine.id}
                        value={medicine.name}
                        disabled={medicine.quantity < 1}
                      >
                        {medicine.name}{" "}
                        {medicine.quantity < 5
                          ? `(Only ${medicine.quantity} left)`
                          : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label htmlFor={`price-${index}`}>Price (₹)</Label>
                  <div className="relative mt-1">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      ₹
                    </span>
                    <Input
                      id={`price-${index}`}
                      type="number"
                      min="0"
                      step="0.01"
                      className="pl-6"
                      value={item.price}
                      onChange={(e) => handlePriceChange(index, e.target.value)}
                      disabled={submitting}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor={`quantity-${index}`}>Quantity</Label>
                  <Input
                    id={`quantity-${index}`}
                    type="number"
                    min="1"
                    className="mt-1"
                    value={item.quantity}
                    onChange={(e) =>
                      handleQuantityChange(index, e.target.value)
                    }
                    disabled={submitting}
                  />
                </div>

                <div>
                  <Label htmlFor={`discount-${index}`}>Discount (%)</Label>
                  <div className="relative mt-1">
                    <Input
                      id={`discount-${index}`}
                      type="number"
                      min="0"
                      max="100"
                      className="pr-6"
                      value={item.discount}
                      onChange={(e) =>
                        handleDiscountChange(index, e.target.value)
                      }
                      disabled={submitting}
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      %
                    </span>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => removeItem(index)}
                    disabled={items.length <= 1 || submitting}
                    className="flex items-center"
                  >
                    <Trash2 size={14} className="mr-1" /> Remove
                  </Button>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      ))}

      <Button
        className="w-full flex items-center justify-center"
        variant="outline"
        onClick={addItem}
        disabled={submitting}
      >
        <Plus size={16} className="mr-2" />
        Add Medicine
      </Button>
    </div>
  );
};

export default PharmacyBillingMobile;