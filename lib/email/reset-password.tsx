import {
    Body,
    Button,
    Container,
    Head,
    Heading,
    Hr,
    Html,
    Link,
    Preview,
    Section,
    Tailwind,
    Text
} from '@react-email/components'

interface ResetPasswordEmailProps {
    username?: string
    resetLink?: string
}

export const ResetPasswordEmail = ({
    username,
    resetLink
}: ResetPasswordEmailProps) => {
    const previewText = `Reset your Better Auth password`
    return (
        <Html>
            <Head />
            <Preview>{previewText}</Preview>
            <Tailwind>
                <Body className='bg-white my-auto mx-auto font-sans px-2'>
                    <Container className='border border-solid border-[#eaeaea] rounded my-[40px] mx-auto p-[20px] max-w-[465px]'>
                        <Heading className='text-black text-[24px] font-normal text-center p-0 my-[30px] mx-0'>
                            Restablece tu contraseña
                        </Heading>
                        <Text className='text-black text-[14px] leading-[24px]'>
                            Hola {username},
                        </Text>
                        <Text className='text-black text-[14px] leading-[24px]'>
                            Hemos recibido una solicitud para restablecer la
                            contraseña de tu cuenta de Better Auth. Si no has
                            realizado esta solicitud, puedes ignorar este correo
                            con seguridad.
                        </Text>
                        <Section className='text-center mt-[32px] mb-[32px]'>
                            <Button
                                className='bg-[#000000] rounded text-white text-[12px] font-semibold no-underline text-center px-5 py-3'
                                href={resetLink}>
                                Resetear contraseña
                            </Button>
                        </Section>
                        <Text className='text-black text-[14px] leading-[24px]'>
                            O copia esta url en el navegador:{' '}
                            <Link
                                href={resetLink}
                                className='text-blue-600 no-underline'>
                                {resetLink}
                            </Link>
                        </Text>
                        <Hr className='border border-solid border-[#eaeaea] my-[26px] mx-0 w-full' />
                        <Text className='text-[#666666] text-[12px] leading-[24px]'>
                            Si tienes alguna pregunta, no dudes en contactarnos.
                        </Text>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    )
}

export function reactResetPasswordEmail(props: ResetPasswordEmailProps) {
    console.log(props)
    return <ResetPasswordEmail {...props} />
}
