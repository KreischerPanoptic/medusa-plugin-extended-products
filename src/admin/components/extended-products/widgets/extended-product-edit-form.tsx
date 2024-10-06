import { Button, Label, Input } from "@medusajs/ui";
import { useForm, Controller } from "react-hook-form";
import { useEffect, useState } from "react";
import { Notify } from "../../../types/notify";
import MDEditor from '@uiw/react-md-editor';
import {
    adminProductKeys,
  useAdminProducts,
  useAdminUpdateProduct
} from "medusa-react";
import {
  AdminPostProductsProductReq,
  AdminPostProductsReq,
  AdminPostProductsProductMetadataReq,
  Product
} from "@medusajs/medusa";
import { ProductProperties } from "../../../../responses/properties";
import { MetadataFormType } from "../../shared/meatadata-form";
import { useQueryClient } from "@tanstack/react-query";

export const getSubmittableMetadata = (
    data: MetadataFormType
  ): Record<string, unknown> => {
    const metadata = data.entries.reduce((acc, { key, value }) => {
      if (key) {
        acc[key] = value;
      }
  
      return acc;
    }, {} as Record<string, unknown>);
  
    if (data.deleted?.length) {
      data.deleted.forEach((key) => {
        metadata[key] = "";
      });
    }
  
    // Preserve complex values that we don't support editing through the UI
    if (data.ignored) {
      Object.entries(data.ignored).forEach(([key, value]) => {
        metadata[key] = value;
      });
    }
  
    return metadata;
  };
  
  export const getMetadataFormValues = (
    metadata?: Record<string, any> | null,
    hiddenKeys: string[] = []
  ): MetadataFormType => {
    const data: MetadataFormType = {
      entries: [],
      deleted: [],
      ignored: {},
    };
  
    if (metadata) {
      Object.entries(metadata).forEach(([key, value]) => {
        if (isPrimitive(value) && !hiddenKeys.includes(key)) {
          data.entries.push({
            key,
            value: value as string,
            state: "existing",
          });
        } else {
          data.ignored![key] = value;
        }
      });
    }
  
    return data;
  };

  const isPrimitive = (value: any): boolean => {
    return (
      value === null ||
      value === undefined ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    );
  };

export type ExtendedProductDetailsFormValues = {
    extended_description?: string | null;
    contents?: string | null;
    terms?: string | null;
    expiration?: string | null;
    calories?: string | null;
    proteins?: string | null;
    fats?: string | null;
    carbs?: string | null;
    processing?: string | null;
    country?: string | null;
    warnings?: string | null;
    packaging?: string | null;
    type?: string | null;
    features?: string | null;
    visits?: number | null;
    videos?: string[] | null;
    metadata: MetadataFormType;
};

const getFieldFromKey = (properties: ProductProperties[], key: string): ProductProperties | undefined => {
    for(let property of properties) {
        if(property.key === key) {
            return property
        }
    }
    return undefined;
}

const getDefaultValues = (
    product: Product | null,
  ): ExtendedProductDetailsFormValues => {
    if(product) {
        if(product.metadata) {
            if(product.metadata.propertiesObj) {
                const properties: ProductProperties[] | undefined = JSON.parse(product.metadata.propertiesObj as string) as ProductProperties[]
                if(properties) {
                    if(properties.length > 0) {
                        return {
                            extended_description: product.description ?? '',
                            visits: product.metadata.visitsCount ? (product.metadata.visitsCount as number) : 0,
                            videos: product.metadata.videoUrls ? (product.metadata.videoUrls as string).split('|') : [],
                            contents: getFieldFromKey(properties, 'contents')?.value ?? '',
                            terms: getFieldFromKey(properties, 'terms')?.value ?? '',
                            expiration: getFieldFromKey(properties, 'expiration')?.value ?? '',
                            calories: getFieldFromKey(properties, 'calories')?.value ?? '',
                            proteins: getFieldFromKey(properties, 'proteins')?.value ?? '',
                            fats: getFieldFromKey(properties, 'fats')?.value ?? '',
                            carbs: getFieldFromKey(properties, 'carbs')?.value ?? '',
                            processing: getFieldFromKey(properties, 'processing')?.value ?? '',
                            country: getFieldFromKey(properties, 'country')?.value ?? '',
                            warnings: getFieldFromKey(properties, 'warnings')?.value ?? '',
                            packaging: getFieldFromKey(properties, 'packaging')?.value ?? '',
                            type: getFieldFromKey(properties, 'type')?.value ?? '',
                            features: getFieldFromKey(properties, 'features')?.value ?? '',
                            metadata: getMetadataFormValues(product?.metadata, ["propertiesObj"]),
                        };
                    }
                }
            }
            
        }
    }
  
    return {
        extended_description: '',
        contents: '',
        terms: '',
        expiration: '',
        calories: '',
        proteins: '',
        fats: '',
        carbs: '',
        processing: '',
        country: '',
        warnings: '',
        packaging: '',
        type: '',
        features: '',
        visits: 0,
        videos: [],
        metadata: getMetadataFormValues({})
    };
};

const ExtendedProductEditModal = ({
    product,
    onSave,
    notify,
  }: {
    product: Product;
    onSave: () => void;
    notify: Notify;
  }) => {
    const form = useForm<ExtendedProductDetailsFormValues>({
      defaultValues: getDefaultValues(product),
    });

    const onReset = () => {
        form.reset(getDefaultValues(product));
    };

    const [isSaving, setIsSaving] = useState(false);

    const queryClient = useQueryClient();

    const { mutateAsync, isLoading } = useAdminUpdateProduct(
        product?.id
    );

    useEffect(() => {
        if (product) {
          form.reset(getDefaultValues(product));
        }
      }, [product]);

    const onSubmit = form.handleSubmit(async (data) => {
        setIsSaving(true);

        const payload: AdminPostProductsProductReq = {
            description: data?.extended_description,
            metadata: product?.metadata
        }

        const properties: ProductProperties[] = [];
        properties.push({
            key: 'contents',
            value: data?.contents
        });
        properties.push({
            key: 'terms',
            value: data?.terms
        });
        properties.push({
            key: 'expiration',
            value: data?.expiration
        });
        properties.push({
            key: 'calories',
            value: data?.calories
        });
        properties.push({
            key: 'proteins',
            value: data?.proteins
        });
        properties.push({
            key: 'fats',
            value: data?.fats
        });
        properties.push({
            key: 'carbs',
            value: data?.carbs
        });
        properties.push({
            key: 'processing',
            value: data?.processing
        });
        properties.push({
            key: 'country',
            value: data?.country
        });
        properties.push({
            key: 'warnings',
            value: data?.warnings
        });
        properties.push({
            key: 'packaging',
            value: data?.packaging
        });
        properties.push({
            key: 'type',
            value: data?.type
        });
        properties.push({
            key: 'features',
            value: data?.features
        });

        const metadataWithProperties = {
            ...getSubmittableMetadata(data?.metadata),
            propertiesObj: JSON.stringify(properties),
            videoUrls: data.videos.join('|'),
            visitsCount: data.visits
          };

        payload.metadata = metadataWithProperties


        mutateAsync(payload, {
            onSuccess: async () => {
              notify.success("Успіх", `Додаткову інформацію для продукта ${payload.title} оновлено`);
              onReset();
              await queryClient.invalidateQueries(adminProductKeys.lists());
            },
            onError: () => {
              notify.error(
                "Помилка",
                `Під час оновлення додаткової інформації для продукта ${payload.title} виникла помилка`
              );
            },
          });
        setIsSaving(false);
        onSave();
    })

    return (
        <form onSubmit={onSubmit}>
            <fieldset className="gap-y-2" title="Розширенний опис">
                <div className="flex flex-col gap-y-4">
                    <div className="flex flex-col gap-y-2">
                        <Label htmlFor="extended_description" className="text-ui-fg-subtle">
                            Опис
                        </Label>
                        <Controller
                            name="extended_description"
                            control={form.control}
                            rules={{ required: false }}
                            render={({ field: { onChange, ...other } }) => (
                                <MDEditor
                                    {...other} onChange={onChange}
                                    textareaProps={
                                        {
                                            placeholder: 'Розширенний опис в якому використовується мова розмітки Markdown'
                                        }
                                    }
                                />
                            )}>
                    </Controller>
                        
                    </div>
                </div>
            </fieldset>
            <fieldset className="gap-y-2" title="Характеристики">
                <div className="flex flex-col gap-y-4">
                    <div className="flex flex-col gap-y-2">
                        <Label htmlFor="contents" className="text-ui-fg-subtle">
                        Склад:
                        </Label>
                        <Input
                        id="contents"
                        type="text"
                        placeholder="фісташка, сіль"
                        {...form.register("contents")}
                        />
                    </div>
                </div>
                <div className="flex flex-col gap-y-4">
                    <div className="flex flex-col gap-y-2">
                        <Label htmlFor="terms" className="text-ui-fg-subtle">
                        Умови зберігання:
                        </Label>
                        <Input
                        id="terms"
                        type="text"
                        placeholder="темне та сухе місце при температурі lj 25℃ та відносній вологості не більше 75%"
                        {...form.register("terms")}
                        />
                    </div>
                </div>
                <div className="flex flex-col gap-y-4">
                    <div className="flex flex-col gap-y-2">
                        <Label htmlFor="expiration" className="text-ui-fg-subtle">
                        Термін зберігання:
                        </Label>
                        <Input
                        id="expiration"
                        type="text"
                        placeholder="до 3 місяців з дати пакування"
                        {...form.register("expiration")}
                        />
                    </div>
                </div>
                <div className="flex flex-col gap-y-4">
                    <div className="flex flex-col gap-y-2">
                        <Label htmlFor="calories" className="text-ui-fg-subtle">
                        {"Поживна цінність (на 100 г):"}
                        </Label>
                        <Input
                        id="calories"
                        type="text"
                        placeholder="556 ККал"
                        {...form.register("calories")}
                        />
                    </div>
                </div>
                <div className="flex flex-col gap-y-4">
                    <div className="flex flex-col gap-y-2">
                        <Label htmlFor="proteins" className="text-ui-fg-subtle">
                        Білки:
                        </Label>
                        <Input
                        id="proteins"
                        type="text"
                        placeholder="50 г"
                        {...form.register("proteins")}
                        />
                    </div>
                </div>
                <div className="flex flex-col gap-y-4">
                    <div className="flex flex-col gap-y-2">
                        <Label htmlFor="fats" className="text-ui-fg-subtle">
                        Жири:
                        </Label>
                        <Input
                        id="fats"
                        type="text"
                        placeholder="20 г"
                        {...form.register("fats")}
                        />
                    </div>
                </div>
                <div className="flex flex-col gap-y-4">
                    <div className="flex flex-col gap-y-2">
                        <Label htmlFor="carbs" className="text-ui-fg-subtle">
                        Вуглеводи:
                        </Label>
                        <Input
                        id="carbs"
                        type="text"
                        placeholder="7 г"
                        {...form.register("carbs")}
                        />
                    </div>
                </div>
                <div className="flex flex-col gap-y-4">
                    <div className="flex flex-col gap-y-2">
                        <Label htmlFor="processing" className="text-ui-fg-subtle">
                        Тип обробки:
                        </Label>
                        <Input
                        id="processing"
                        type="text"
                        placeholder="Смажені"
                        {...form.register("processing")}
                        />
                    </div>
                </div>
                <div className="flex flex-col gap-y-4">
                    <div className="flex flex-col gap-y-2">
                        <Label htmlFor="country" className="text-ui-fg-subtle">
                        Країні походження:
                        </Label>
                        <Input
                        id="country"
                        type="text"
                        placeholder="США"
                        {...form.register("country")}
                        />
                    </div>
                </div>
                <div className="flex flex-col gap-y-4">
                    <div className="flex flex-col gap-y-2">
                        <Label htmlFor="warnings" className="text-ui-fg-subtle">
                        Попередження:
                        </Label>
                        <Input
                        id="warnings"
                        type="text"
                        placeholder="Містить волоський горіх. Може містити фрагменти оболонки"
                        {...form.register("warnings")}
                        />
                    </div>
                </div>
                <div className="flex flex-col gap-y-4">
                    <div className="flex flex-col gap-y-2">
                        <Label htmlFor="packaging" className="text-ui-fg-subtle">
                        Упаковка:
                        </Label>
                        <Input
                        id="packaging"
                        type="text"
                        placeholder="Скляна банка"
                        {...form.register("packaging")}
                        />
                    </div>
                </div>
                <div className="flex flex-col gap-y-4">
                    <div className="flex flex-col gap-y-2">
                        <Label htmlFor="type" className="text-ui-fg-subtle">
                        Тип продукту:
                        </Label>
                        <Input
                        id="type"
                        type="text"
                        placeholder="Нерафінована олія"
                        {...form.register("type")}
                        />
                    </div>
                </div>
                <div className="flex flex-col gap-y-4">
                    <div className="flex flex-col gap-y-2">
                        <Label htmlFor="features" className="text-ui-fg-subtle">
                        Особливості:
                        </Label>
                        <Input
                        id="features"
                        type="text"
                        placeholder="Не містить глютену"
                        {...form.register("features")}
                        />
                    </div>
                </div>
            </fieldset>
            {/* <fieldset className="gap-y-2" title="Відео">

            </fieldset> */}
            <hr/>
            <div className="flex flex-col gap-y-4">
                <div className="flex flex-col gap-y-2">
                    <Button onClick={() => {onReset();}} variant="secondary" disabled={isLoading || isSaving}>
                        Скасувати
                    </Button>
                    <Button type="submit" isLoading={isLoading || isSaving}>Зберегти</Button>
                </div>
            </div>
        </form>
    );
}

export default ExtendedProductEditModal;